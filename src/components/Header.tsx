import { SignIn, UserButton, useUser } from "@clerk/nextjs";
import type { NextComponentType } from "next";
import Link from "next/link";
import NavButton from "./NavButton";
import { useEffect, useState } from "react";
import { Card, Row, Text } from "@nextui-org/react";
import { useSpring, animated } from "@react-spring/web";


const Header = (props: Props) => {
  const user = useUser()
  const [newDialog, setNewDialog] = useState(false)

  const setDialog = () => {
    setNewDialog(!newDialog)
  }


  const modalSpring = useSpring({
    from: { opacity: 0, scale: 0.9 },
    to: { opacity: newDialog ? 1 : 0, scale: newDialog ? 1 : 0.9 },
    config: { tension: 200, friction: 20 }
  })


  return (
    <header className='fixed w-full p-2 z-20 flex mx-auto'>
      <nav className='w-full justify-between flex items-center'>
        <div className='flex items-center'>
          <h2 className='font-semibold tracking-lighter text-lg mr-2'>VisuaThought</h2>
          <NavButton onClick={setDialog}>New</NavButton>
          {newDialog &&
            <animated.div style={modalSpring} className='new-modal absolute top-9 left-32'>
              <Card variant='shadow' style={{ display: 'inline-block', width: 'auto', border: '1px solid #0006' }}>
                <Card.Body css={{ py: "$10", height: '100%' }}>
                  <NavButton disabled className='mb-2'>New Spaces</NavButton>
                </Card.Body>
                <Card.Divider />
              </Card>

            </animated.div>
          }

        </div>
        <div className='flex items-center'>
          {!user.user ?
            <NavButton href='/sign-in'>Sign In</NavButton>
            :
            <UserButton />
          }
        </div>
      </nav>

    </header>

  );
};

export default Header;