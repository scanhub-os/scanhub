/**
 * Copyright (C) 2024, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
 * SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial
 *
 * Navigation.tsx is responsible for rendering the navigation bar at the top of the page.
 */
import React, { useContext, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'

import AdminPanelSettingsSharpIcon from '@mui/icons-material/AdminPanelSettingsSharp'
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import ListAltIcon from '@mui/icons-material/ListAlt'
import DesignServicesIcon from '@mui/icons-material/DesignServices';
import TripOriginRoundedIcon from '@mui/icons-material/TripOriginRounded';
import LineStyleIcon from '@mui/icons-material/LineStyle'
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import Divider from '@mui/joy/Divider';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded'
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded'
import BrightnessAutoIcon from '@mui/icons-material/BrightnessAuto';
import LogoutSharpIcon from '@mui/icons-material/LogoutSharp'
import Person2SharpIcon from '@mui/icons-material/Person2Sharp'
import PersonSharpIcon from '@mui/icons-material/PersonSharp'
import RecentActorsSharpIcon from '@mui/icons-material/RecentActorsSharp'
import Avatar from '@mui/joy/Avatar'
import Box from '@mui/joy/Box'
import Chip from '@mui/joy/Chip'
import Button from '@mui/joy/Button'
import IconButton from '@mui/joy/IconButton'
import ListDivider from '@mui/joy/ListDivider'
import ListItemDecorator from '@mui/joy/ListItemDecorator'
import Dropdown from '@mui/joy/Dropdown'
import MenuButton from '@mui/joy/MenuButton'
import Menu from '@mui/joy/Menu'
import MenuItem from '@mui/joy/MenuItem'
import Typography from '@mui/joy/Typography'
import { useColorScheme } from '@mui/joy/styles'
import { useColorScheme as useMaterialColorScheme } from '@mui/material/styles'

import LoginContext from '../LoginContext'
import { UserRole } from '../openapi/generated-client/userlogin'
import logo from '../media/logo.png'
import { loginApi } from '../api'
import { version } from '../utils/Versions'
import ManagerStatus from './ManagerStatus'
import DeviceStatus from './DeviceStatus'
import PasswordModal from './PasswordModal'


function ColorSchemeToggle() {
  const { mode, setMode } = useColorScheme()
  const { setMode: setMuiMode } = useMaterialColorScheme()

  let modeicon = <BrightnessAutoIcon sx={{ fontSize: 'var(--IconFontSize)' }} />
  if (mode === 'light') {
    modeicon = <LightModeRoundedIcon sx={{ fontSize: 'var(--IconFontSize)' }} />
  } else if (mode === 'dark') {
    modeicon = <DarkModeRoundedIcon sx={{ fontSize: 'var(--IconFontSize)' }} />
  }

  return (
    <IconButton
      id='toggle-mode'
      variant='plain'
      color='primary'
      size='sm'
      onClick={() => {
        if (mode === 'system') {
          setMode('dark')
          setMuiMode('dark')
        } else if (mode === 'dark') {
          setMode('light')
          setMuiMode('light')
        } else {
          setMode('system')
          setMuiMode('system')
        }
      }}
    >
      {modeicon}
    </IconButton>
  )
}


export default function Navigation() {
  const loc = useLocation()
  const [user, setUser] = useContext(LoginContext)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  // Menu elements
  const menuItems = [
    // { id: 0, text: 'Patients', link: '/', icon: <RecentActorsSharpIcon sx={{ fontSize: 'var(--IconFontSize)' }} /> },
    { id: 0, text: 'Patients', link: '/', icon: <TaskAltIcon sx={{ fontSize: 'var(--IconFontSize)' }} /> },
    { id: 1, text: 'Library', link: '/library', icon: <DesignServicesIcon sx={{ fontSize: 'var(--IconFontSize)' }} /> },
    // { id: 1, text: 'Templates', link: '/templates', icon: <ListAltIcon /> },
    // { id: 2, text: 'Devices', link: '/devices', icon: <TripOriginRoundedIcon /> },
    // { id: 3, text: 'Sequences', link: '/sequences', icon: <LineStyleIcon /> },
  ]
  if (user && user.role == UserRole.Admin) {
    menuItems.push({ id: 4, text: 'Users', link: '/users', icon: <ManageAccountsIcon /> })
  }

  return (
    <Box
      component='header'
      className='Header'
      sx={{
        height: 'var(--Navigation-height)',
        p: 2,
        gap: 0,
        bgcolor: 'background.surface',
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid',
        borderColor: 'divider',
        position: 'sticky',
        top: 0,
        zIndex: 'snackbar',
      }}
    >
      <IconButton variant='plain'>
        <a href='https://github.com/scanhub-os' target='_blank' rel="noreferrer noopener">
          <img
            src={logo}
            alt=''
            height='30'
            className='d-inline-block'
          />
        </a>
      </IconButton>

      <Typography level='h4' sx={{ mr: 6, ml: 2 }}>
        ScanHub
      </Typography>

      <>
        {menuItems?.map((item) => (
          <Button
            component={RouterLink}
            to={item.link}
            size='sm'
            color='primary'
            startDecorator={item.icon}
            disabled={loc.pathname === item.link}
            variant={loc.pathname === item.link ? 'soft' : 'plain'}
            key={item.id}
            sx={{ display: 'inline-flex' }}
          >
            <Typography level='body-sm'>{item.text}</Typography>
          </Button>
        ))}
      </>

      <Box sx={{ display: 'flex', flexDirection: 'row-reverse', alignItems: 'center', width: '100%', gap: 2 }}>
        <ColorSchemeToggle />
        <ManagerStatus />
        <DeviceStatus />
        <Divider orientation="vertical" />
        <Chip
          variant='soft'
          color='warning'
          size='sm'
          sx={{ px: 2, py: 0.5, width: 'fit-content' }}
        >
          {'v' + version + ' not for clinical use!'}
        </Chip>
      </Box>

      {/* User menu */}
      <Dropdown>
        <MenuButton
          color='primary'
          slots={{ root: IconButton }}
          sx={{ ml: 2 }}
          size='sm'
        >
          {/* <Avatar variant='soft' color='primary' sx={{ fontSize: 'var(--IconFontSize)' }} /> */}
          <AccountCircleIcon sx={{ fontSize: 'var(--IconFontSize)' }} />
        </MenuButton>

        <Menu
          id='positioned-demo-menu'
          size='sm'
          onClose={() => {

          }}
          aria-labelledby='positioned-demo-button'
          placement='bottom-end'
          sx={{ zIndex: 'tooltip' }}
        >
          <MenuItem
            key='currentuser'
            disabled
            sx={{ m: 'auto', fontWeight: 'bold' }}
          >
            {user?.username}
          </MenuItem>
          <ListDivider />
          <MenuItem
            key='profile'
            disabled
            onClick={() => {

            }}
          >
            <ListItemDecorator>
              <PersonSharpIcon />
            </ListItemDecorator>{' '}
            Profile
          </MenuItem>
          <MenuItem
            key='password'
            onClick={() => {
              setPasswordModalOpen(true);
            }}
          >
            <ListItemDecorator>
              <AdminPanelSettingsSharpIcon />
            </ListItemDecorator>{' '}
            Set Password
          </MenuItem>
          <ListDivider />
          <MenuItem
            key='logout'
            onClick={() => {
              loginApi
                .logoutApiV1UserloginLogoutPost()
                .then(() => {
                  console.log('Logout.')
                  queryClient.clear() // make sure the user who logs in next, can't see data not meant for them (e.g. list of all users)
                  setUser(null)
                  navigate('/')
                })
            }}
          >
            <ListItemDecorator>
              <LogoutSharpIcon />
            </ListItemDecorator>{' '}
            Logout
          </MenuItem>
        </Menu>
      </Dropdown>

      <PasswordModal
        onSubmit={() => { }}
        isOpen={passwordModalOpen}
        setOpen={setPasswordModalOpen}
        modalType={'modify'}
        item={user?.username ? user.username : ''}
      />

    </Box>
  )
}
