/**
 * Copyright (C) 2024, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
 * SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial
 *
 * ManagerStatus.tsx is responsible for rendering the manager status bar.
 */
import React from 'react'

import Box from '@mui/joy/Box'
import Chip from '@mui/joy/Chip'
import LinkIcon from '@mui/icons-material/Link';
import IconButton from '@mui/joy/IconButton'
import Typography from '@mui/joy/Typography'
import Tooltip from '@mui/joy/Tooltip'
import { ClickAwayListener } from '@mui/base';

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

function ManagerStatusInfo({ items }: { items: Array<{ name: string; isHealthy: boolean; isLoading: boolean }> }) {
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
                isLoading ? <CircularProgress determinate={false} size='sm' sx={{ '--CircularProgress-size': '20px' }} /> :
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

  const [tooltipHovered, setTooltipHovered] = React.useState(false);
  const [tooltipPinned, setTooltipPinned] = React.useState(false);
  const tooltipOpen = tooltipHovered || tooltipPinned

  const healthItems = healthChecks.map(cfg => ({ name: cfg.name, ...useManagerHealthCheck(cfg.key, cfg.queryFn, cfg.name) }));
  const anyUnhealthy = healthItems.some(i => !i.isLoading && !i.isHealthy);

  return (
    <ClickAwayListener onClickAway={() => { if (tooltipPinned) setTooltipPinned(false) }}>
      <Tooltip
        placement='bottom'
        variant='outlined'
        describeChild={false}
        arrow
        title={<ManagerStatusInfo items={healthItems} />}
        open={tooltipOpen}
        modifiers={[
          { name: 'preventOverflow', options: { padding: 10 } }, // skidding=8 (down), distance=20 (further right)
        ]}
      >
        <IconButton
          variant='plain'
          color='primary'
          size='sm'
          onClick={() => setTooltipPinned(prev => !prev)}
          onMouseEnter={() => setTooltipHovered(true)}
          onMouseLeave={() => setTooltipHovered(false)}
        >
          {
            anyUnhealthy ? <ErrorOutlineIcon sx={{ fontSize: 'calc(var(--Status-height) - 1)' }} /> :
              <LinkIcon sx={{ fontSize: 'calc(var(--Status-height) - 1)' }} />
          }
        </IconButton>
      </Tooltip>
    </ClickAwayListener>
  )
}
