/**
 * Copyright (C) 2024, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
 * SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial
 *
 * Navigation.tsx is responsible for rendering the navigation bar at the top of the page.
 */
import React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import Box from '@mui/joy/Box'
import Chip from '@mui/joy/Chip'
import LinkIcon from '@mui/icons-material/Link';
import IconButton from '@mui/joy/IconButton'
import Select from '@mui/joy/Select';
import Option from '@mui/joy/Option';
import Typography from '@mui/joy/Typography'
import Tooltip from '@mui/joy/Tooltip'
import { ClickAwayListener } from '@mui/base';

import { deviceApi } from '../api'
import { DeviceOut } from '../openapi/generated-client/device/api'
import Sheet from '@mui/joy/Sheet'
import { useManagerHealthCheck } from '../hooks/useManagerHealthCheck'
import {
  patientManagerHealthApi,
  examManagerHealthApi,
  workflowManagerHealthApi,
  userLoginManagerHealthApi,
  deviceManagerHealthApi
} from '../api'
import CircularProgress from '@mui/joy/CircularProgress'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';



// Device all health checks
const healthChecks = [
  {
    name: 'Patient Manager',
    key: 'patientManagerHealthCheck',
    queryFn: () => patientManagerHealthApi.readinessApiV1PatientHealthReadinessGet({ timeout: 1000 }).then(r => r.data),
  },
  {
    name: 'Exam Manager',
    key: 'examManagerHealthCheck',
    queryFn: () => examManagerHealthApi.readinessApiV1ExamHealthReadinessGet({ timeout: 1000 }).then(r => r.data),
  },
  {
    name: 'Workflow Manager',
    key: 'workflowManagerHealthCheck',
    queryFn: () => workflowManagerHealthApi.readinessApiV1WorkflowmanagerHealthReadinessGet({ timeout: 1000 }).then(r => r.data),
  },
  {
    name: 'User Login Manager',
    key: 'userLoginManagerHealthCheck',
    queryFn: () => userLoginManagerHealthApi.readinessApiV1UserloginHealthReadinessGet({ timeout: 1000 }).then(r => r.data),
  },
  {
    name: 'Device Manager',
    key: 'deviceManagerHealth',
    queryFn: () => deviceManagerHealthApi.readinessApiV1DeviceHealthReadinessGet({ timeout: 1000 }).then(r => r.data),
  } 
]

function ManagerStatus({ items }: { items: Array<{ name: string; isHealthy: boolean; isLoading: boolean }>}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '1fr auto', // left column flexible, right column auto-sized
        rowGap: 2,                       // vertical spacing between rows
        columnGap: 4,                    // horizontal spacing
        alignItems: 'center',            // vertical centering per row
        p: 2
      }}
    >
      {
        items.map(({ name, isHealthy, isLoading }, index) => {
          return (
            <React.Fragment key={`manager-healt-check-${index}`}>
              <Typography level='body-xs'>{name}</Typography>
              {
                isLoading ? <CircularProgress determinate={false} size='sm' sx={{'--CircularProgress-size': '20px'}}/> :
                  <Chip
                    size="sm"
                    color={isHealthy ? 'success' : 'danger'}
                    variant="solid"
                    sx={{ mr: 1 }}
                  >
                    {isHealthy ? 'Healthy' : 'Unhealthy'}
                  </Chip>
              }
            </React.Fragment>
          );
        })
      }
    </Box>
  )
}


export default function StatusBar() {

  const queryClient = useQueryClient()

  const [tooltipHovered, setTooltipHovered] = React.useState(false);
  const [tooltipPinned, setTooltipPinned] = React.useState(false);
  const tooltipOpen = tooltipHovered || tooltipPinned

  const healthItems = healthChecks.map(cfg => ({ name: cfg.name, ...useManagerHealthCheck(cfg.key, cfg.queryFn, cfg.name) }));
  const anyUnhealthy = healthItems.some(i => !i.isLoading && !i.isHealthy);

  const selectedDeviceId = queryClient.getQueryData<string | null>(['selectedDeviceId'])
  const setSelectedDeviceId = (id: string | null) => queryClient.setQueryData(['selectedDeviceId'], id)

  // Get list of all devices
  const { data: devices } = useQuery<DeviceOut[]>({
    queryKey: ['devices'],
    queryFn: async () => {
      const result = await deviceApi.getDevicesApiV1DeviceGet()
      if (selectedDeviceId === null && result.data.length > 0) {
        setSelectedDeviceId(result.data[0].id)
      }
      return result.data
    },
  })

  // Prefetch device status after list of devices has been loaded
  React.useEffect(() => {
    if (devices) {
      devices.forEach((device) =>
        queryClient.prefetchQuery({
          queryKey: ['deviceStatus', device.id],
          queryFn: async () => {
            const res = await deviceApi.getDeviceApiV1DeviceDeviceIdGet(device.id);
            return res.data.status ?? undefined;
          },
          staleTime: 10_000,
        })
      );
    }
  }, [devices]);

  // Poll only the selected device, but more frequently to get updated device status
  const { data: deviceStatus } = useQuery<string | undefined>({
    queryKey: ['deviceStatus', selectedDeviceId], // depends on selected device

    queryFn: async () => {
      if (!selectedDeviceId) throw new Error('No device selected')
      // Call your API to get this device’s latest status
      const result = await deviceApi.getDeviceApiV1DeviceDeviceIdGet(selectedDeviceId)
      return result.data.status ? result.data.status as string : undefined
    },
    enabled: !!selectedDeviceId,     // only run when a device is selected
    refetchInterval: 1000,         // poll every second
    refetchIntervalInBackground: true,
  })

  
  return (
    <Sheet
      variant='solid'
      color='primary'
      sx={{
        height: 'var(--Status-height)',
        gap: 0,
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingRight: 2,
        paddingLeft: 2,
        alignItems: 'center',
        overflow: 'hidden',
        position: 'sticky', // or "fixed" if you always want it visible
        bottom: 0,  // stick to the bottom instead of top
        zIndex: 'snackbar', // keep above main content, below snackbar
      }}
    >
      {
        devices && devices?.length > 0 && <Select
          variant='solid'
          color='primary'
          value={selectedDeviceId || null}
          onChange={(_, newValue) => {setSelectedDeviceId(newValue)}}
          placeholder="Select a device..."
          renderValue={(selected) => {
            if (!selected) return '-'
            const device = devices?.find(d => d.id === selected.value)
            return device ? `${device.name}: ${deviceStatus ?? device.status ?? '-'}` : '-'
          }}
          sx={{
            minHeight: 0,
            height: 'var(--Status-height)',
            fontSize: 'sm',
          }}
          slotProps={{
            listbox: {
              variant: 'outlined',
              color: 'neutral',
            },
            indicator: {
              sx: {
                order: -1, // move indicator to the start
                marginRight: '0.5rem',
                marginLeft: '-0.5rem',
              },
            },
          }}
        >
          {
            devices.map((device) => (
              <Option key={device.id} value={device.id} variant='plain' color='neutral'>
                {device.name}
              </Option>
            ))
          }
        </Select>
      }

      <ClickAwayListener onClickAway={() => { if (tooltipPinned) setTooltipPinned(false) }}>
        <Tooltip
          placement='bottom'
          variant='outlined'
          describeChild={false}
          arrow
          title={<ManagerStatus items={healthItems}/>}
          open={tooltipOpen}
          modifiers={[
            { name: 'preventOverflow', options: { padding: 10 } }, // skidding=8 (down), distance=20 (further right)
          ]}
        >
          <IconButton
            variant='solid'
            color='primary'
            sx={{
              minHeight: 0,
              height: 'var(--Status-height)',
              ml: 'auto'
            }}
            onClick={() => setTooltipPinned(prev => !prev)}
            onMouseEnter={() => setTooltipHovered(true)}
            onMouseLeave={() => setTooltipHovered(false)}
          >
            {
              anyUnhealthy ? <ErrorOutlineIcon sx={{ fontSize: 'calc(var(--Status-height) - 1)' }}/> :
                <LinkIcon sx={{ fontSize: 'calc(var(--Status-height) - 1)' }} />
            }
          </IconButton>
        </Tooltip>
      </ClickAwayListener>
    </Sheet>
  )
}
