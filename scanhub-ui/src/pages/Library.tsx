import React from 'react'
import Grid from '@mui/joy/Grid'
import DeviceView from './DeviceView'
import SequenceView from './SequenceView'
import TemplatesView from './TemplatesView'
import { flex } from '@mui/system'

function LibraryView() {
    return (
        <Grid container columns={2} sx={{ flex: 1, width: '100%', height: '100%', overflow: 'hidden' }}>
            {/* Top Row: DeviceView and SequenceView */}
            <Grid xs={1} sx={{
                height: '50%',
                borderRight: '1px solid',
                borderBottom: '1px solid',
                borderColor: 'divider',
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <DeviceView />
            </Grid>
            <Grid xs={1} sx={{
                height: '50%',
                borderBottom: '1px solid',
                borderColor: 'divider',
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <SequenceView />
            </Grid>

            {/* Bottom Row: TemplatesView */}
            <Grid xs={2} sx={{
                height: '50%',
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column',
            }}>
                <TemplatesView />
            </Grid>
        </Grid>
    )
}

export default LibraryView;