/**
 * Copyright (C) 2024, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
 * SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial
 *
 * App.tsx is the main view of the react app. It is responsible for rendering the navigation bar and the main content.
 */
import React from 'react'
import axios, { AxiosError } from 'axios'
import { Outlet } from 'react-router-dom'
import Box from '@mui/joy/Box'
import Snackbar from '@mui/joy/Snackbar'
import { useQueryClient } from '@tanstack/react-query'

import NotificationContext from '../NotificationContext'
import Navigation from '../components/Navigation'
import LoginContext from '../LoginContext'


export default function App() {

  const [messageObj, setMessageObject] = React.useContext(NotificationContext)
  const [, showNotification] = React.useContext(NotificationContext)
  const [user, setUser] = React.useContext(LoginContext)
  const queryClient = useQueryClient()

  React.useEffect(() => {
    // globally set authorization header
    axios.defaults.headers.common['Authorization'] = 'Bearer ' + user?.access_token;
    // reset authorization after logout
    return () => axios.defaults.headers.common['Authorization'] = undefined
  }, [user])

  React.useEffect(() => {
    const interceptor = axios.interceptors.response.use(function (response) {
      // Any status code that lie within the range of 2xx cause this function to trigger
      // Do something with response data
      return response;
    }, function (error: AxiosError<{ detail: string }>) {
      // Any status codes that falls outside the range of 2xx cause this function to trigger
      // Do something with response error
      if (error.response?.status === 401 && error.response?.data.detail == 'Invalid token.') {
        console.log('Invalid token (probably due to timeout): Automatic Logout!')
        setUser(null)
        queryClient.clear() // make sure the user who logs in next, can't see data not meant for them (e.g. list of all users)
      } else {
        showNotification({ message: 'A problem with the connection to the server occurred!', type: 'warning' })
      }
      return Promise.reject(error);
    });
    return () => {
      // clean up of the effect (reset the interceptor)
      axios.interceptors.response.eject(interceptor);
    }
  }, [])

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
      }}
    >

      <Navigation />

      <Snackbar
        open={messageObj.visible === true || messageObj.visible === undefined}
        variant={'soft'}
        color={messageObj.type}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        onClose={() => setMessageObject({ ...messageObj, visible: false })}
      >
        {messageObj.message.toString()}
      </Snackbar>

      {/* Main content */}
      <Box
        sx={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  )
}
