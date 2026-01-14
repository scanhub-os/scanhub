/**
 * Copyright (C) 2024, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
 * SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial
 *
 * TaskModal.tsx is responsible for rendering a modal with an interface to create a new task or to modify an existing task.
 */
import Tabs from '@mui/joy/Tabs';
import TabList from '@mui/joy/TabList';
import Tab, { tabClasses } from '@mui/joy/Tab';
import TabPanel from '@mui/joy/TabPanel';
import Button from '@mui/joy/Button'
import FormLabel from '@mui/joy/FormLabel'
import Input from '@mui/joy/Input'
import Modal from '@mui/joy/Modal'
import ModalClose from '@mui/joy/ModalClose'
import ModalDialog from '@mui/joy/ModalDialog'
import Tooltip from '@mui/joy/Tooltip'
import Option from '@mui/joy/Option'
import Select from '@mui/joy/Select'
import Stack from '@mui/joy/Stack'
import Grid from '@mui/joy/Grid'
import Textarea from '@mui/joy/Textarea'
import Typography from '@mui/joy/Typography'
import React from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import TaskInfo from './TaskInfo';
import { deviceApi, sequenceApi, taskApi, workflowManagerApi } from '../api'
import { 
  MRISequenceOut,
  BaseAcquisitionTask,
  AcquisitionTaskOut,
  TaskType,
  ItemStatus,
  AcquisitionParameter,
  DAGTaskOut,
  BaseDAGTask,
  CalibrationType
} from '../openapi/generated-client/exam'

import { DeviceOut } from '../openapi/generated-client/device/api'
import { ModalPropsCreate, ModalPropsModify } from '../interfaces/components.interface'
import NotificationContext from '../NotificationContext'


function AcquisitionTaskForm(props: ModalPropsCreate | ModalPropsModify<AcquisitionTaskOut>)
{
  // The form is in this separate component to make sure that the state is reset after closing the modal

  const [, showNotification] = React.useContext(NotificationContext)

  const [task, setTask] = React.useState<BaseAcquisitionTask & { task_type: 'ACQUISITION' }>(
    props.modalType == 'modify'
      ? { ...(props.item as BaseAcquisitionTask), status: ItemStatus.Updated, task_type: 'ACQUISITION' }
      : {
          workflow_id: props.parentId,              // eslint-disable-line camelcase
          name: '',
          description: '',
          task_type: 'ACQUISITION',
          destination: '',
          status: ItemStatus.New,
          progress: 0,
          is_template: props.createTemplate,        // eslint-disable-line camelcase
          device_id: undefined,
          sequence_id: '',
          calibration: CalibrationType.No,
          acquisition_parameter: {
            fov_scaling: { x: 1., y: 1., z: 1. },
            fov_offset: { x: 0., y: 0., z: 0. },
            fov_rotation: { x: 0., y: 0., z: 0. },
          } as AcquisitionParameter,
        }
  );

  // Post a new/modified task and reset
  const mutation = 
    props.modalType == 'modify' ?
      useMutation({
        mutationFn: async () => {
          await taskApi.updateTaskApiV1ExamTaskTaskIdPut(props.item.id, task)
          .then(() => {
            props.onSubmit()
            showNotification({message: 'Updated acquisition task.', type: 'success'})
          })
        }
      })
    :
      useMutation({
        mutationFn: async () => {
          await taskApi.createTaskApiV1ExamTaskNewPost(task)
          .then(() => {
            console.log('Created task', task)
            props.onSubmit()
            showNotification({message: 'Created acquisition ask.', type: 'success'})
          })
        }
      })

  const {
    data: sequences,
    // isLoading: isLoadingSequences,
    // isError: isErrorSequences,
    // refetch: refetchSequences,
  } = useQuery<MRISequenceOut[]>({
    queryKey: ['sequences'],
    queryFn: async () => {
      return await sequenceApi.getAllMriSequencesApiV1ExamSequencesAllGet()
        .then((result) => {
          return result.data
        })
    },
  })

  const {
    data: devices,
    // isLoading: isLoadingDevices,
    // isError: isErrorDevices,
    // refetch: refetchDevices,
  } = useQuery<DeviceOut[]>({
    queryKey: ['devices'],
    queryFn: async () => {
      return await deviceApi
        .getDevicesApiV1DeviceGet()
        .then((result) => {
          return result.data
        })
    },
  })

  const title = props.modalType == 'modify' ? 'Update Acquisition Task' : 'Create New Acquisition Task'

  return (
    <>
      <Typography id='basic-modal-dialog-title' component='h2' level='inherit' fontSize='1.25em' mb='0.25em'>
        {title}
      </Typography>

      <Stack direction='column' spacing={4} useFlexGap sx={{ flexWrap: 'wrap' }}>
        
        <Stack spacing={1}>
          <FormLabel>Name</FormLabel>
          <Input
            name={'name'}
            onChange={(e) => setTask({ ...task, [e.target.name]: e.target.value })}
            value={task.name}
          />
        </Stack>
        
        <Stack spacing={1}>
          <FormLabel>Description</FormLabel>
          <Textarea
            minRows={2}
            name={'description'}
            onChange={(e) => setTask({ ...task, [e.target.name]: e.target.value })}
            defaultValue={task.description}
          />
        </Stack>
        
        <Stack spacing={4} direction={'row'}>

          <Stack spacing={1}>
            <FormLabel>Calibration</FormLabel>
            <Select
              value={task.calibration}
              defaultValue={CalibrationType.No}
              size='sm'
              onChange={(_, value) => {
                if (value) { setTask({ ...task, 'calibration': value }) }
              }}
            >
              <Option key={'no'} value={CalibrationType.No}>No calibration</Option>
              <Option key={'all'} value={CalibrationType.All}>Full</Option>
              <Option key={'frequency'} value={CalibrationType.Frequency}>Calibrate frequency</Option>
              <Option key={'flipangle'} value={CalibrationType.FlipAngle}>Calibrate flip angle</Option>
              <Option key={'shims'} value={CalibrationType.Shims}>Calibrate shims</Option>
            </Select>
          </Stack>

          <Stack spacing={1}>
            <FormLabel>Sequence</FormLabel>
            <Select
              value={task.sequence_id ? task.sequence_id : null}
              placeholder={'Select a sequence...'}
              size='sm'
              onChange={(event, value) => {
                if (value) {
                  setTask({ ...task, 'sequence_id': value.toString() })
                }
              }}
            >
              {sequences?.map((sequence) => {
                return (
                  <Option key={sequence.name + ' (' + sequence._id + ')'} value={sequence._id}>
                    {sequence.name}
                  </Option>
                )
              })}
            </Select>
          </Stack>
          
          <Stack spacing={1}>
            <FormLabel>Device</FormLabel>
            <Select
              value={task.device_id ? task.device_id : null}
              placeholder={'Select a device...'}
              size='sm'
              onChange={(event, value) => {
                if (value) {
                  setTask({ ...task, 'device_id': value.toString() })
                }
              }}
            >
              {devices?.map((device) => {
                return (
                  <Option key={device.id} value={device.id}>
                    {device.name}
                  </Option>
                )
              })}
            </Select>
          </Stack>

        </Stack>

        <Stack spacing={1}>
          <FormLabel>Field of View Offset</FormLabel>
          <Stack spacing={1} direction={'row'}>
            {(['x', 'y', 'z'] as const).map((index) => (
              <React.Fragment key={'FovOffset' + index}>
                <FormLabel key={'FormLabelFovOffset' + index}>{index}</FormLabel>
                <Input
                  key={'InputFovOffset' + index}
                  type="number"
                  size='sm'
                  slotProps={ {input: {min: -10000, max: 10000}} }
                  value={task.acquisition_parameter?.fov_offset?.[index] ?? 0}
                  endDecorator="px"
                  onChange={(event) => {
                    setTask(prevTask => ({
                      ...prevTask,
                      acquisition_parameter: {
                        ...prevTask.acquisition_parameter!,
                        fov_offset: {
                          // Spread existing offset so we don't lose x, y, or z
                          ...prevTask.acquisition_parameter!.fov_offset,
                          // Update only the specific field (x, y, or z) dynamically
                          [index]: event.target.valueAsNumber,
                        }
                      }
                    }))
                  }}
                />
              </React.Fragment>
            ))}
          </Stack>
        </Stack>

        <Stack spacing={1}>
          <FormLabel>Field of View Scaling</FormLabel>
          <Stack spacing={1} direction={'row'}>
            {(['x', 'y', 'z'] as const).map((index) => (
              <React.Fragment key={'FovScaling' + index}>
                <FormLabel key={'FormLabelFovScaling' + index}>{index}</FormLabel>
                <Input
                  key={'InputFovScaling' + index}
                  type="number"
                  size='sm'
                  slotProps={ {input: {min: 0, max: 100}} }
                  value={task.acquisition_parameter?.fov_scaling?.[index] ?? 0}
                  endDecorator="px"
                  onChange={(event) => {
                    setTask(prevTask => ({
                      ...prevTask,
                      acquisition_parameter: {
                        ...prevTask.acquisition_parameter!,
                        fov_scaling: {
                          // Spread existing scaling so we don't lose x, y, or z
                          ...prevTask.acquisition_parameter!.fov_scaling,
                          // Update only the specific field (x, y, or z) dynamically
                          [index]: event.target.valueAsNumber,
                        }
                      }
                    }))
                  }}
                />
              </React.Fragment>
            ))}
          </Stack>
        </Stack>

        <Stack spacing={1}>
          <FormLabel>Field of View Rotation</FormLabel>
          <Stack spacing={1} direction={'row'}>
            {(['x', 'y', 'z'] as const).map((index) => (
              <React.Fragment key={'FovRotation' + index}>
                <FormLabel key={'FormLabelFovRotation' + index}>{index}</FormLabel>
                <Input
                  key={'InputFovRotation' + index}
                  type="number"
                  size='sm'
                  slotProps={ {input: {min: 0, max: 360}} }
                  value={task.acquisition_parameter?.fov_rotation?.[index] ?? 0}
                  endDecorator="px"
                  onChange={(event) => {
                    setTask(prevTask => ({
                      ...prevTask,
                      acquisition_parameter: {
                        ...prevTask.acquisition_parameter!,
                        fov_rotation: {
                          // Spread existing rotation so we don't lose x, y, or z
                          ...prevTask.acquisition_parameter!.fov_rotation,
                          // Update only the specific field (x, y, or z) dynamically
                          [index]: event.target.valueAsNumber,
                        }
                      }
                    }))
                  }}
                />
              </React.Fragment>
            ))}
          </Stack>
        </Stack>

        <Button
          size='sm'
          sx={{ maxWidth: 120 }}
          onClick={(event) => {
            event.preventDefault()
            if (task.name == '') {
              showNotification({message: 'Task name must not be empty.', type: 'warning'})
            }
            else if (task.description == '') {
              showNotification({message: 'Task description must not be empty.', type: 'warning'})
            }
            else {
              mutation.mutate()
              props.setOpen(false)
            }
          }}
        >
          Save
        </Button>
      </Stack>
    </>
  )
}


function DagTaskForm(props: ModalPropsCreate | ModalPropsModify<DAGTaskOut>)
{
  // The form is in this separate component to make sure that the state is reset after closing the modal
  const [, showNotification] = React.useContext(NotificationContext)

  const [task, setTask] = React.useState<BaseDAGTask & { task_type: 'DAG' }>(
    props.modalType == 'modify'
      ? { ...(props.item as BaseDAGTask), status: ItemStatus.Updated, task_type: 'DAG' }
      : {
          workflow_id: props.parentId,              // eslint-disable-line camelcase
          name: '',
          description: '',
          task_type: 'DAG',
          destination: '',
          status: ItemStatus.New,
          progress: 0,
          is_template: props.createTemplate,        // eslint-disable-line camelcase
          dag_type: TaskType.Reconstruction,
          dag_id: '',
        }
  );

  // Post a new/modified task and reset
  const mutation = 
    props.modalType == 'modify' ?
      useMutation({
        mutationFn: async () => {
          await taskApi.updateTaskApiV1ExamTaskTaskIdPut(props.item.id, task)
          .then(() => {
            props.onSubmit()
            showNotification({message: 'Updated DAG task.', type: 'success'})
          })
        }
      })
    :
      useMutation({
        mutationFn: async () => {
          await taskApi.createTaskApiV1ExamTaskNewPost(task)
          .then(() => {
            console.log('Created task', task)
            props.onSubmit()
            showNotification({message: 'Created DAG task.', type: 'success'})
          })
        }
      })

  const {
    data: jobs,
    // isLoading: isLoadingDags,
    // isError: isErrorDags,
    // refetch: refetchDags,
  } = useQuery<Array<{ job_id: string; job_name: string }>>({
    queryKey: ['jobs'],
    queryFn: async () => {
      const result = await workflowManagerApi.listAvailableTasksApiV1WorkflowmanagerTasksGet();
      // Map to only include dag_id and dag_display_name
      return result.data.map((job: { job_id: string; job_name: string }) => ({
        job_id: job.job_id,
        job_name: job.job_name,
      }));
    },
  })

  const {
    data: inputTasks,
    // isLoading: isLoadingDevices,
    // isError: isErrorDevices,
    // refetch: refetchDevices,
  } = useQuery<(AcquisitionTaskOut | DAGTaskOut)[]>({
    queryKey: ['inputTasks'],
    queryFn: async () => {
      const workflowId = props.modalType == 'create' ? props.parentId : props.item.workflow_id
      if (workflowId) {
        return await taskApi
          .getAllWorkflowTasksApiV1ExamTaskAllWorkflowIdGet(workflowId)
          .then((result) => {
            if (props.modalType == 'modify') {
              // Filter out the current task being modified
              return (result.data as (AcquisitionTaskOut | DAGTaskOut)[]).filter(
                (task) => task.id !== props.item.id
              );
            }
            return result.data as (AcquisitionTaskOut | DAGTaskOut)[]
          })
      }
      return []
    },
  })

  const title = props.modalType == 'modify' ? 'Update DAG Task' : 'Create New DAG Task'

  return (
    <>
      <Typography id='basic-modal-dialog-title' component='h2' level='inherit' fontSize='1.25em' mb='0.25em'>
        {title}
      </Typography>


      <Stack spacing={1}>
        <Grid container rowSpacing={1.5} columnSpacing={5}>
          <Grid md={12}>
            <FormLabel>Name</FormLabel>
            <Input
              name={'name'}
              onChange={(e) => setTask({ ...task, [e.target.name]: e.target.value })}
              value={task.name}
            />
          </Grid>

        
          <Grid md={12}>
            <FormLabel>Description</FormLabel>
            <Textarea
              minRows={2}
              name={'description'}
              onChange={(e) => setTask({ ...task, [e.target.name]: e.target.value })}
              defaultValue={task.description}
            />
          </Grid>

          <Grid md={4}>
            <FormLabel>DAG</FormLabel>
            <Select
              value={task.dag_id ? task.dag_id : null}
              placeholder={'Select a DAG...'}
              size='sm'
              onChange={(event, value) => {
                if (value) {
                  setTask({ ...task, 'dag_id': value })
                }
              }}
            >
              {jobs?.map((job) => {
                return (
                  <Option key={job.job_id} value={job.job_id}>
                    {job.job_name}
                  </Option>
                )
              })}
            </Select>
          </Grid>

          <Grid md={4}>
            <FormLabel>DAG Type</FormLabel>
            <Select
              value={task.dag_type ? task.dag_type : null}
              defaultValue={TaskType.Reconstruction}
              size='sm'
              onChange={(_, value) => {
                if (value) {
                  setTask({ ...task, 'dag_type': value })
                }
              }}
            >
              <Option key={'reconstruction'} value={TaskType.Reconstruction}>Reconstruction</Option>
              <Option key={'processing'} value={TaskType.Processing}>Processing</Option>
            </Select>
          </Grid>

          <Grid md={4}>
            <FormLabel>Input</FormLabel>
            <Select
              value={task.input_task_ids ? task.input_task_ids[0] : null}
              placeholder={'Select an input...'}
              size='sm'
              onChange={(event, value) => {
                if (value) {
                  setTask({ ...task, 'input_task_ids': [value] })
                }
              }}
            >
              {inputTasks?.map((inputTask) => {
                return (
                  <Tooltip
                    key={`tooltip-${inputTask.id}`}
                    placement='right'
                    variant='outlined'
                    arrow
                    title={<TaskInfo data={inputTask} />}
                  >
                    <Option key={`option-${inputTask.id}`} value={inputTask.id}>
                      {inputTask.name}
                    </Option>
                  </Tooltip>
                )
              })}
            </Select>
          </Grid>
        
          <Grid md={12}>
            <Button
              size='sm'
              sx={{ maxWidth: 120 }}
              onClick={(event) => {
                event.preventDefault()
                if (task.name == '') {
                  showNotification({message: 'Task name must not be empty.', type: 'warning'})
                }
                else if (task.description == '') {
                  showNotification({message: 'Task description must not be empty.', type: 'warning'})
                }
                else {
                  mutation.mutate()
                  props.setOpen(false)
                }
              }}
            >
              Save
            </Button>
          </Grid>

        </Grid>
      </Stack>
    </>
  )
}


export default function TaskModal(props: ModalPropsCreate | ModalPropsModify<AcquisitionTaskOut | DAGTaskOut>) {

  return (
    <Modal
      open={props.isOpen}
      color='neutral'
      onClose={() => props.setOpen(false)}
      sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
    >
      <ModalDialog
        aria-labelledby='basic-modal-dialog-title'
        aria-describedby='basic-modal-dialog-description'
        sx={{ width: '75vw', maxHeight: 'calc(100vh - 2 * var(--Navigation-height))', borderRadius: 'md', p: 5, overflow: 'auto'}}
      >
        <ModalClose
          sx={{
            top: '10px',
            right: '10px',
            borderRadius: '50%',
            bgcolor: 'background.body',
          }}
        />
        {
          props.modalType === 'modify' && 'item' in props ? 
            (props.item.task_type === TaskType.Acquisition ?
              <AcquisitionTaskForm {...props as ModalPropsModify<AcquisitionTaskOut>} /> :
              (props.item.task_type === TaskType.Dag && <DagTaskForm {...props as ModalPropsModify<DAGTaskOut>} />)) :
          <Tabs aria-label="tabs" defaultValue={0} sx={{ bgcolor: 'transparent' }}>
            <TabList
              disableUnderline
              sx={{
                p: 0.5,
                gap: 0.5,
                borderRadius: 'xl',
                bgcolor: 'background.level1',
                [`& .${tabClasses.root}[aria-selected="true"]`]: {
                  boxShadow: 'sm',
                  bgcolor: 'background.surface',
                },
              }}
            >
              <Tab disableIndicator>Acquisition task</Tab>
              <Tab disableIndicator>DAG task</Tab>
            </TabList>
            <TabPanel value={0}>
              <AcquisitionTaskForm {...props as ModalPropsCreate} />
            </TabPanel>
            <TabPanel value={1}>
              <DagTaskForm {...props as ModalPropsCreate} />
            </TabPanel>
          </Tabs>
        }
      </ModalDialog>
    </Modal>
  )
}
