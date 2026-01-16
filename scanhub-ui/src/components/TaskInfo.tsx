/**
 * Copyright (C) 2024, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
 * SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial
 *
 * TaskInfo.tsx is responsible for rendering additional information of a task item.
 */
import React from 'react'

import Box from '@mui/joy/Box'
import Stack from '@mui/joy/Stack'
import Typography from '@mui/joy/Typography'

import { AcquisitionTaskOut, DAGTaskOut, TaskType, CalibrationType } from '../openapi/generated-client/exam'


function capitalize(str: string){
  if (!str)
    return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}


function TaskInfo({ data: task }: { data: AcquisitionTaskOut | DAGTaskOut }) {

  const datetime_created = new Date(task.datetime_created)
  const datetime_updated = task.datetime_updated ? new Date(String(task.datetime_updated)) : undefined

  const getCalibrationSequenceString = (sequence: CalibrationType[]) => {
    // Mapping each enum value to its display string
    const labels = (sequence ?? []).map((item) => {
      if (item === CalibrationType.Frequency) return 'Freq.';
      if (item === CalibrationType.FlipAngle) return 'Power';
      if (item === CalibrationType.Shims) return 'Shims';
      return item;
    });

    // Join them with a comma and a space
    return labels.join(' > ');
  }

  return (
    <Box sx={{display: 'flex', alignItems: 'stretch'}}>
      <Box
        sx={{
          rowGap: 0.4,
          columnGap: 4,
          p: 2,
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          '& > *:nth-of-type(odd)': {
            color: 'text.secondary',
          },
        }}
      >
        <Typography fontSize='sm'>ID</Typography>
        <Typography level='body-sm' textColor='text.primary'>
          {task.id}
        </Typography>

        <Typography fontSize='sm'>Name</Typography>
        <Typography level='body-sm' textColor='text.primary'>
          {task.name}
        </Typography>

        <Typography fontSize='sm'>Description</Typography>
        <Typography level='body-sm' textColor='text.primary'>
          {task.description}
        </Typography>

        <Typography fontSize='sm'>Type</Typography>
        <Typography level='body-sm' textColor='text.primary'>
            {capitalize(task.task_type)}
          {task.task_type === TaskType.Dag && 'dag_type' in task && task.dag_type ? `, ${capitalize(task.dag_type)}` : ''}
        </Typography>

        {
          task.task_type === TaskType.Acquisition && 'device_id' in task &&
          <>
            <Typography fontSize='sm'>Device ID</Typography>
            <Typography level='body-sm' textColor='text.primary'>
              {task.device_id ? String(task.device_id) : '-'}
            </Typography>
          </>
        }

        {
          task.task_type === TaskType.Acquisition && 'sequence_id' in task &&
          <>
            <Typography fontSize='sm'>Sequence ID</Typography>
            <Typography level='body-sm' textColor='text.primary'>
              {task.sequence_id ? String(task.sequence_id) : '-'}
            </Typography>
          </>
        }

        {
          task.task_type === TaskType.Acquisition && 'calibration' in task && task.calibration &&
          <>
            <Typography fontSize='sm'>Calibration</Typography>
            <Typography level='body-sm' textColor='text.primary'>
              { getCalibrationSequenceString(task.calibration) }
            </Typography>
          </>
        }

        {
          task.task_type === TaskType.Acquisition && 'acquisition_parameter' in task && task.acquisition_parameter &&
          <>
            <Typography fontSize='sm'>Acquisition parameter</Typography>
            <Stack direction='column'>
              <Typography level='body-sm' textColor='text.primary'>
                FoV scaling: x={task.acquisition_parameter.fov_scaling?.x}, y={task.acquisition_parameter.fov_scaling?.y}, z={task.acquisition_parameter.fov_scaling?.z}
              </Typography>
              <Typography level='body-sm' textColor='text.primary'>
                FoV offset: x={task.acquisition_parameter.fov_offset?.x}, y={task.acquisition_parameter.fov_offset?.y}, z={task.acquisition_parameter.fov_offset?.z}
              </Typography>
              <Typography level='body-sm' textColor='text.primary'>
                FoV rotation: x={task.acquisition_parameter.fov_rotation?.x}, y={task.acquisition_parameter.fov_rotation?.y}, z={task.acquisition_parameter.fov_rotation?.z}
              </Typography>
            </Stack>
          </>
        }

        {
          task.task_type === TaskType.Dag && 'dag_id' in task &&
          <>
            <Typography fontSize='sm'>DAG ID</Typography>
            <Typography level='body-sm' textColor='text.primary'>
              {task.dag_id}
            </Typography>
          </>
        }

        {
          task.task_type === TaskType.Dag && 'input_task_ids' in task &&
          <>
            <Typography fontSize='sm'>Input</Typography>
            <Typography level='body-sm' textColor='text.primary'>
              {task.input_task_ids ? task.input_task_ids : '-'}
            </Typography>
          </>
        }

        {
          task.task_type === TaskType.Dag && 'parameter' in task &&
          <>
            <Typography fontSize='sm'>Parameter</Typography>
            <Stack direction='column'>
              {
                task.parameter && Object.entries(task.parameter).map((arg, index) => (
                  <Typography key={index} level='body-sm' textColor='text.primary'>
                    {arg[0]}: {arg[1]}
                  </Typography>
                ))
              }
            </Stack>
          </>
        }

        <Typography fontSize='sm'>Status</Typography>
        <Typography level='body-sm' textColor='text.primary'>
          {capitalize(task.status)}
        </Typography>

        <Typography fontSize='sm'>Progress</Typography>
        <Typography level='body-sm' textColor='text.primary'>
          {task.progress}
        </Typography>

        <Typography fontSize='sm'>Is Template</Typography>
        <Typography level='body-sm' textColor='text.primary'>
          {task.is_template ? 'True' : 'False'}
        </Typography>

        <Typography fontSize='sm'>Creator</Typography>
        <Typography level='body-sm' textColor='text.primary'>
          {task.creator}
        </Typography>

        <Typography level='body-sm'>Last update</Typography>
        <Typography level='body-sm' textColor='text.primary'>
          {
            datetime_updated ? datetime_updated.toLocaleDateString() + ', ' + datetime_updated.toLocaleTimeString()
            : datetime_created.toLocaleDateString() + ', ' + datetime_created.toLocaleTimeString()
          }
        </Typography>

      </Box>
    </Box>
  )
}

export default TaskInfo
