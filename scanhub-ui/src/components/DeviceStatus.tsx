/**
 * Copyright (C) 2024, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
 * SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial
 *
 * DeviceStatus.tsx is responsible for rendering the device status bar.
 */
import React from 'react'

import Box from '@mui/joy/Box'
import Chip from '@mui/joy/Chip'
import TripOriginRoundedIcon from '@mui/icons-material/TripOriginRounded';
import IconButton from '@mui/joy/IconButton'
import Typography from '@mui/joy/Typography'
import Tooltip from '@mui/joy/Tooltip'
import { ClickAwayListener } from '@mui/base';
import CircularProgress from '@mui/joy/CircularProgress'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

import { useQuery } from '@tanstack/react-query'
import { deviceApi } from '../api'
import { DeviceOut, DeviceStatus as DeviceStatusEnum } from '../openapi/generated-client/device/api'


function DeviceStatusInfo({ items }: { items: Array<DeviceOut> }) {
    // Mapping device status to Chip color
    const getStatusColor = (status?: string) => {
        switch (status) {
            case DeviceStatusEnum.Online:
                return 'success';
            case DeviceStatusEnum.Busy:
                return 'warning';
            case DeviceStatusEnum.Offline:
                return 'neutral';
            case DeviceStatusEnum.Error:
                return 'danger';
            default:
                return 'neutral';
        }
    }

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
                items.map((device) => {
                    return (
                        <React.Fragment key={device.id}>
                            <Typography level='body-xs'>{device.name}</Typography>
                            <Chip
                                size="sm"
                                color={getStatusColor(device.status as unknown as string)}
                                variant="solid"
                                sx={{ mr: 1 }}
                            >
                                {(device.status as unknown as string) || 'Unknown'}
                            </Chip>
                        </React.Fragment>
                    );
                })
            }
        </Box>
    )
}


export default function DeviceStatus() {

    const [tooltipHovered, setTooltipHovered] = React.useState(false);
    const [tooltipPinned, setTooltipPinned] = React.useState(false);
    const tooltipOpen = tooltipHovered || tooltipPinned

    const { data: devices, isLoading, isError } = useQuery<DeviceOut[]>({
        queryKey: ['devices'],
        queryFn: async () => {
            const result = await deviceApi.getDevicesApiV1DeviceGet()
            return result.data
        },
        // Poll every 5 seconds to keep status more or less fresh
        refetchInterval: 5000,
    })

    // Sort by latest activity and take top 5
    // We need to handle potential undefined datetime_updated, fall back to datetime_created or 0
    const sortedDevices = React.useMemo(() => {
        if (!devices) return [];
        return [...devices].sort((a, b) => {
            const dateA = new Date((a.datetime_updated || a.datetime_created) as any).getTime();
            const dateB = new Date((b.datetime_updated || b.datetime_created) as any).getTime();
            return dateB - dateA;
        }).slice(0, 5);
    }, [devices]);

    const anyError = sortedDevices.some(d => (d.status as unknown as string) === DeviceStatusEnum.Error);

    if (isLoading || isError || sortedDevices.length === 0) {
        // If loading or error, or no devices, we might want to hide it or show a neutral state.
        // ManagerStatus shows even if loading (with spinner).
        // Here we definitely want to show something if we are fetching.
        // If no devices, maybe just disable or show generic icon?
        // Let's render the button anyway.
    }

    return (
        <ClickAwayListener onClickAway={() => { if (tooltipPinned) setTooltipPinned(false) }}>
            <Tooltip
                placement='bottom'
                variant='outlined'
                describeChild={false}
                arrow
                title={isLoading ? <CircularProgress size="sm" /> : <DeviceStatusInfo items={sortedDevices} />}
                open={tooltipOpen}
                modifiers={[
                    { name: 'preventOverflow', options: { padding: 10 } },
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
                        anyError ? <ErrorOutlineIcon sx={{ fontSize: 'var(--IconFontSize)' }} /> :
                            <TripOriginRoundedIcon sx={{ fontSize: 'var(--IconFontSize)' }} />
                    }
                </IconButton>
            </Tooltip>
        </ClickAwayListener>
    )
}
