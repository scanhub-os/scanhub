/**
 * Copyright (C) 2024, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
 * SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial
 *
 * Routes.tsx is responsible for defining the routes of the react app.
 */
import React from 'react'
import { useContext } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

import CssBaseline from '@mui/joy/CssBaseline';
import { GlobalStyles } from '@mui/system'
import { CssVarsProvider as JoyCssVarsProvider } from '@mui/joy/styles'
import {
  THEME_ID as MATERIAL_THEME_ID,
  Experimental_CssVarsProvider as MaterialCssVarsProvider,
  extendTheme as materialExtendTheme,
} from '@mui/material/styles'

import LoginContext from './LoginContext'
import App from './pages/App'
import Login from './pages/LoginView'
import PatientListView from './pages/PatientListView'
import AcquisitionView from './pages/AcquisitionView'
import TemplatesView from './pages/TemplatesView'
import UserManagementView from './pages/UserManagementView'
import SequenceView from './pages/SequenceView'
import DeviceView from './pages/DeviceView'
import LibraryView from './pages/Library';

const materialTheme = materialExtendTheme()

export function RouteConfiguration() {
  const navigate = useNavigate()
  const [user, setUser] = useContext(LoginContext)
  const location = useLocation()

  return (
    <MaterialCssVarsProvider defaultMode='system' theme={{ [MATERIAL_THEME_ID]: materialTheme }}>
      <JoyCssVarsProvider defaultMode='system' disableTransitionOnChange>
        <CssBaseline />
        <GlobalStyles
          styles={{
            ':root': {
              '--Collapsed-breakpoint': '769px', // form will stretch when viewport is below `769px`
              '--Cover-width': '40vw', // must be `vw` only
              '--Form-maxWidth': '700px',
              '--Transition-duration': '0.4s', // set to `none` to disable transition
              '--Sidebar-width': '360px',
              '--Navigation-height': '50px',
              '--Status-height': '22px',
              '--IconFontSize': '22px',
            },
          }}
        />

        <Routes>
          <Route path='/' element={user ? <App /> : <Navigate to='/login' state={{ from: location }} />}>
            <Route index element={<PatientListView />} />
            <Route path=':patientId' element={<AcquisitionView />} />
            <Route path='/library' element={<LibraryView />} />
            <Route path='/templates' element={<TemplatesView />} />
            <Route path='/devices' element={<DeviceView />} />
            <Route path='/sequences' element={<SequenceView />} />
            <Route path='/users' element={<UserManagementView />} />
          </Route>

          <Route
            path='/login'
            element={
              <Login
                onLogin={(newuser) => {
                  console.log('Login confirmed.')
                  setUser(newuser)
                  if (location.state?.from?.pathname) {     // allows injection of invalid pathes that are in some cases not matched by the default route (e.g. http://google.de)
                    navigate(location.state.from.pathname)  // assuming that the navigate function is generally robust against forged inputs, that should not be a big problem
                  }
                  else {
                    console.log('No main page given in location.state.from, so start at default route /')
                    navigate('/')
                  }
                }}
              />
            }
          />
          <Route path='*' element={<Navigate to='/' />} />
        </Routes>
      </JoyCssVarsProvider>
    </MaterialCssVarsProvider>
  )
}
