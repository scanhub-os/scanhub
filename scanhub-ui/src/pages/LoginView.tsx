/**
 * Copyright (C) 2024, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
 * SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial
 *
 * LoginView.tsx is responsible for rendering the user log in screen.
 */
import Alert from '@mui/joy/Alert'
import Button from '@mui/joy/Button'
import FormLabel from '@mui/joy/FormLabel'
import Input from '@mui/joy/Input'
import Stack from '@mui/joy/Stack'
import Typography from '@mui/joy/Typography'
import React, { useState } from 'react'
import logo from '../media/logo.png'

import { loginApi, userApi } from '../api'
import UserCreateModal from '../components/UserCreateModal'
import { User } from '../openapi/generated-client/userlogin'


const enum LoginErrorState {
  NoError,
  InvalidCredentials,
  EmptyUsernameOrPassword,
  OtherError,
}


function Login(props: { onLogin: (user: User) => void }) {
  const [loginErrorState, setLoginErrorState] = useState<LoginErrorState>(LoginErrorState.NoError)
  const [loginRequestInProgress, setLoginRequestInProgress] = useState<boolean>(false)

  const [noUsersInDB, setNoUsersInDB] = useState(false)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  function checknousers() {
    userApi
      .checkNoUsersApiV1UserloginChecknousersGet()
      .then((result) => {
        setNoUsersInDB(result.data)
      })
  }

  React.useEffect(() => {
    console.log('Try autologin with cookie.')
    setLoginRequestInProgress(true)
    loginApi
      .loginfromcookieApiV1UserloginLoginfromcookiePost()
      .then((result) => {
        setLoginRequestInProgress(false)
        props.onLogin(result.data)
      })
      .catch(() => {
        console.log('Autologin not successfull.')
        setLoginRequestInProgress(false)
        checknousers()
      })
  }, [])

  return (
    <Stack direction='column' justifyContent='center' alignItems='center' spacing={2} sx={{ height: '70vh' }}>

      <UserCreateModal
        isOpen={noUsersInDB}
        setOpen={() => { }}
        onSubmit={checknousers}
        modalType={'createFirstUser'}
      />

      <a href='https://github.com/scanhub-os' target='_blank' rel="noreferrer noopener">
        <img
          src={logo}
          alt=''
          height='100'
          className='d-inline-block'
        />
      </a>

      <Typography level='title-lg' style={{ textAlign: 'center' }}>
        ScanHub
      </Typography>

      <form
        onSubmit={(event) => {
          event.preventDefault() // do not reload the page
          if (username == '' || password == '') {
            setLoginErrorState(LoginErrorState.EmptyUsernameOrPassword)
            console.log('Username or password must not be empty.')
          } else {
            setLoginRequestInProgress(true)
            setLoginErrorState(LoginErrorState.NoError)
            console.log('Submit login.')

            // Consider sending a secure password hash like argon2 instead of the password itself.
            // On the server this hash could be hashed again, just like if it were the password.
            // Disadvantage is, that the swagger-UI would not work, because it strictly follows OAuth2 which requires the non-hashed password.
            loginApi
              .loginApiV1UserloginLoginPost(username, password, 'password')
              .then((result) => {
                setLoginRequestInProgress(false)
                props.onLogin(result.data)
              })
              .catch((error) => {
                setLoginRequestInProgress(false)
                if (error?.response?.data?.detail == 'Invalid authentication credentials') {
                  console.log('Invalid authentication credentials')
                  setLoginErrorState(LoginErrorState.InvalidCredentials)
                } else {
                  console.log('Error at login:', error)
                  setLoginErrorState(LoginErrorState.OtherError)
                }
              })
          }
        }}
      >
        <Stack gap={1.5} sx={{ width: 250 }}>
          <Stack>
            <FormLabel>Username</FormLabel>
            <Input
              placeholder='user'
              onChange={(e) => {
                e.preventDefault()
                setUsername(e.target.value)
              }}
              autoFocus
            />
          </Stack>

          <Stack>
            <FormLabel>Password</FormLabel>
            <Input
              type='password'
              placeholder='password'
              onChange={(e) => {
                e.preventDefault()
                setPassword(e.target.value)
              }}
            />
          </Stack>

          <Button type='submit' loading={loginRequestInProgress} fullWidth={true}>
            Login
          </Button>
        </Stack>
      </form>
      {loginErrorState == LoginErrorState.InvalidCredentials ? (
        <Alert color='warning'>Invalid username or password.</Alert>
      ) : null}
      {loginErrorState == LoginErrorState.OtherError ? (
        <Alert color='warning'>Other error at login, please talk to the developer.</Alert>
      ) : null}
      {loginErrorState == LoginErrorState.EmptyUsernameOrPassword ? (
        <Alert color='warning'>Username or password must not be empty.</Alert>
      ) : null}
    </Stack>
  )
}

export default Login
