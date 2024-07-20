// import { useState } from 'react'

import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";

import {
    AppShell,
    Burger,
    MantineProvider,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

import '@mantine/core/styles.css'
import './App.css'

// XXX(msy) Themes https://github.com/mantinedev/vite-min-template
// XXX(msy) Logo next to Burger
export default function App() {
    const [opened, { toggle }] = useDisclosure();

    const router = createBrowserRouter([
        {
            path: "/",
            element: (
                <AppShell
                    header={{ height: 60 }}
                    navbar={{
                        width: 300,
                        breakpoint: 'sm',
                        collapsed: { mobile: !opened },
                    }}
                    padding="md"
                >
                    <AppShell.Header>
                        <Burger
                            opened={opened}
                            onClick={toggle}
                            hiddenFrom="sm"
                            size="sm"
                        />
                    </AppShell.Header>
                    <AppShell.Navbar p="md">Navbar</AppShell.Navbar>
                    <AppShell.Main>Main</AppShell.Main>
                </AppShell>
            ),
        },
    ]);
  return (
      <MantineProvider>
          <RouterProvider router={router} />
      </MantineProvider>
  );
}
