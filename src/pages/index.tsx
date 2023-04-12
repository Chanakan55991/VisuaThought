import Head from "next/head";
import Header from "~/components/Header";
import { Card, Row, Textarea } from "@nextui-org/react";

import { api } from "~/utils/api";
import GrabbableObject from "~/components/GrabbableObject";
import { useUser } from "@clerk/nextjs";
import React, { useState, useEffect } from "react";
import { saveNotesLocal, getNotesLocal } from "~/localstorage/noteStore";
import type { Notes } from "@prisma/client";
import { useSpring, animated } from "@react-spring/web";
import NavButton from "~/components/NavButton";
//import Paint from "~/components/Painting";
import type { UseTRPCQueryResult } from "@trpc/react-query/shared";
import { createId } from "@paralleldrive/cuid2";
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import { visit } from 'unist-util-visit'
import { remove } from 'unist-util-remove'
import remark2rehype from 'remark-rehype'
import stringify from 'rehype-stringify'
import { Toaster, toast } from "react-hot-toast";

interface DispNote extends Notes {
  title?: string,
  mdBody: string
}

const remarkProcessor = unified()
  .use(remarkParse)
  .use(remark2rehype)
  .use(stringify)

const Home = () => {

  const user = useUser()

  const [notesState, setNotes] = useState<DispNote[]>([])
  const [localStateNotes, setLocalNotes] = useState<Notes[]>([])
  const [newCard, setNewCard] = useState(false)
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const [lastOpened, setLastOpened] = useState(false)
  const [shouldRenderNotes, setRenderNotes] = useState(false)
  const [shouldRun, setShouldRun] = useState(true)
  const [mouseClick, setMouseClick] = useState(false)
  const [headerCreateClicked, setCreateClicked] = useState(false)
  const [createValue, setCreateValue] = useState('')
  const [prevUserState, setPrevUserState] = useState(false)
  const [shouldUpdateLocal, setShouldUpdateLocal] = useState(true)
  const [userToInitialize, SetUserInitialized] = useState(false)
  const { mutate: storeNote } = api.notes.storeNote.useMutation({
    onError: (err) => {
      const errorMsg = err.data?.zodError?.fieldErrors.content
      if (errorMsg && errorMsg[0]) {
        toast.error(errorMsg[0])
      } else toast.error('Unable to save notes to the cloud')
    }
  })

  const { mutate: updateUserMetadata } = api.notes.updateUserInitialized.useMutation({
    onError: (err) => {
      const errorMsg = err.data?.zodError?.fieldErrors.content
      if (errorMsg && errorMsg[0]) {
        toast.error(errorMsg[0])
      } else toast.error('Unable to initialize the user')
    }
  })

  const setHeaderClicked = (value: boolean) => {
    setCreateClicked(value)
  }

  const handleMouseDown = (event: React.MouseEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    setMouseClick(true)
    setLastOpened(newCard)
    setNewCard(false)
    setModalPosition({ x: event.clientX, y: event.clientY });
  };

  const handleMouseUp = (event: React.MouseEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    setMouseClick(false)
    const deltaX = Math.abs(event.clientX - modalPosition.x);
    const deltaY = Math.abs(event.clientY - modalPosition.y);
    // change all these delta thing to be use for selection later
    if (lastOpened) {
      setNewCard(false)
      setLastOpened(false)
    } else if (deltaX < 5 && deltaY < 5) {
      setNewCard(true)
    } else {
      setModalPosition({ x: 0, y: 0 });
      setNewCard(false)
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      setNewCard(false)
      if (!createValue) return
      const newId = createId()
      const note = {
        id: newId,
        content: createValue,
        positionX: modalPosition.x,
        positionY: modalPosition.y,
        createdAt: new Date(),
        updatedAt: null,
        isDefault: false,
        authorId: user.user ? user.user.id : '0'
      }

      const notes: Notes[] = getNotesLocal()
      notes.push(note)
      saveNotesLocal(notes)
      setLocalNotes(notes)

      if (user.user) {
        storeNote({
          notes: note
        })
      }

      setCreateValue('') // fix this idk what this do, the notes are still saved in html instead of markdown
    }
  }
  type RemoteNotes = UseTRPCQueryResult<Notes[], unknown>;

  let remoteNotes: RemoteNotes
  if (user.user) {
    remoteNotes = api.notes.getNotes.useQuery();
  } else {
    remoteNotes = api.notes.getDefaultNotes.useQuery();
  }

  useEffect(() => {
    if (shouldRun && user.isLoaded && remoteNotes.data) {
      setRenderNotes(true)
      setShouldRun(false)
    }
  }, [user.isLoaded, remoteNotes.data, shouldRun])

  useEffect(() => {
    if (headerCreateClicked) setNewCard(false)
  }, [headerCreateClicked])

  const noteSpring = useSpring({
    from: { opacity: 0, scale: 0.9 },
    to: { opacity: newCard ? 1 : 0, scale: newCard ? 1 : 0.9, left: modalPosition.x, top: modalPosition.y },
    config: { tension: 200, friction: 20 },
  })

  useEffect(() => {
    if (shouldUpdateLocal) {
      setShouldUpdateLocal(false)
      setLocalNotes(getNotesLocal())
    }
  }, [shouldUpdateLocal])

  useEffect(() => {
    if (!remoteNotes.data || !user.isLoaded) return
    const localNotes: Notes[] = localStateNotes

    const existingNotes = new Map(localNotes.map((note: Notes) => [note.id, note]))
    let mergedNotes: Notes[]

    localNotes.forEach((localNote: Notes) => {
      const existingNote = existingNotes.get(localNote.id)
      if (!existingNote || (localNote.updatedAt ?? localNote.createdAt) > (existingNote.createdAt ?? existingNote.createdAt)) {
        existingNotes.set(localNote.id, localNote)
      }
    })

    if (remoteNotes.data) {
      remoteNotes.data?.forEach((remoteNote: Notes) => {
        const existingNote = existingNotes.get(remoteNote.id)
        if (!existingNote || (remoteNote.updatedAt ?? remoteNote.createdAt) > (existingNote.updatedAt ?? existingNote.createdAt)) {
          existingNotes.set(remoteNote.id, remoteNote)
        }
      })
    }

    mergedNotes = [...existingNotes.values()]
    if (user.isSignedIn) {
      if (!prevUserState) {
        localNotes.forEach((note) => {
          if (note.authorId === '0') {
            if (note.isDefault) {
              if (user.user.publicMetadata.hasOwnProperty('userInitialized') && user.user.publicMetadata.userInitialized as boolean) return
              SetUserInitialized(true)
            }
            // mutate to server then save to mergednotes
            const nid = createId()
            const defToUserNote = {
              ...note,
              id: nid,
              authorId: user.user.id
            }

            storeNote({
              notes: defToUserNote
            })

            mergedNotes.push(defToUserNote)
          }
        })
        setPrevUserState(true)
      }
      mergedNotes = mergedNotes.filter(note => note.authorId !== '0')
      setShouldUpdateLocal(true)
      if (userToInitialize) {
        SetUserInitialized(false)
        updateUserMetadata({
          initialized: true
        })
      }
    } else {
      if (prevUserState) setPrevUserState(false)
      mergedNotes = mergedNotes.filter(note => note.authorId === '0') // user might have logged out so clear any of the users notes
    }

    saveNotesLocal(mergedNotes)

    const dispNote = mergedNotes.map(n => {
      const note = { ...n } as DispNote
      const ast = remarkProcessor.parse(note.content)
      let aTitle: string | undefined = undefined
      visit(ast, 'heading', (node) => {
        if (!aTitle) {
          const child = node.children[0]
          if (child && child.type === 'text') aTitle = child.value
        }
      })

      remove(ast, { type: 'heading', depth: 1 })
      const htmlAst = remarkProcessor.runSync(ast)
      const html = remarkProcessor.stringify(htmlAst)
      note.title = aTitle
      note.content = html
      note.mdBody = n.content
      return note
    })

    setNotes(dispNote)
  }, [remoteNotes?.data, user.isSignedIn, localStateNotes, storeNote, prevUserState, user.isLoaded, user.user?.id, updateUserMetadata, user.user?.publicMetadata, userToInitialize])

  return (
    <>
      <Head>
        <title>VisuaThought</title>
        <meta name="description" content="A mind-mapping and note-taking application with fun included" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Toaster />
      <Header mouseClickedMain={mouseClick} createClicked={setHeaderClicked} />
      <main className="flex h-full min-h-screen flex-col bg overflow-auto" onMouseDown={handleMouseDown} onMouseUp={handleMouseUp}>
        {shouldRenderNotes &&
          notesState.map(note => {
            //            const formattedDate = new Date(note.createdAt).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'long' });

            return (
              <GrabbableObject title={note.title} mdBody={note.mdBody} body={note.content} startXPos={note.positionX} startYPos={note.positionY} key={note.id} id={note.id} createdAt={note.createdAt} />)
          })}

        {newCard &&
          <animated.div style={noteSpring} className={`card-modal absolute`} >
            <Card variant='shadow' style={{ display: 'inline-block', width: 'auto', border: '1px solid #0006' }}>
              <Card.Body>
                <Textarea onKeyDown={handleKeyDown} onChange={(e) => setCreateValue(e.target.value)} placeholder='Jot down your mind!' />
              </Card.Body>
              <Card.Divider />
              <Card.Body css={{ py: "$6", height: '100%' }}>
                <Row>
                  <NavButton className='mr-2 bg-red-300'>Remove</NavButton>
                  <NavButton className='flex justify-center items-center mr-2'>P</NavButton>
                  <div className='inline-block relative px-[9px] py-[5px] border border-[#0006] rounded-md'>
                    <label>
                      <input type='checkbox' />
                    </label>
                  </div>
                </Row>
              </Card.Body>
            </Card>

          </animated.div>
        }
      </main>
    </>
  );
};

export default Home;
