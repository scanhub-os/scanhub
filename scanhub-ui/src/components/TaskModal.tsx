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
import Sheet from '@mui/joy/Sheet';
import Box from '@mui/joy/Box';
import Chip from '@mui/joy/Chip';
import ChipDelete from '@mui/joy/ChipDelete';
import List from '@mui/joy/List';
import ListItem from '@mui/joy/ListItem';
import ListItemContent from '@mui/joy/ListItemContent';
// Icons
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import AddIcon from '@mui/icons-material/Add';
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
import { width } from '@mui/system';


function AcquisitionTaskForm(props: ModalPropsCreate | ModalPropsModify<AcquisitionTaskOut>) {
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
        calibration: [],
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
              showNotification({ message: 'Updated acquisition task.', type: 'success' })
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
              showNotification({ message: 'Created acquisition ask.', type: 'success' })
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



  // Helper: Add item to sequence
  const addCalibration = (type: CalibrationType) => {
    setTask((prev) => ({
      ...prev,
      calibration: [...(prev.calibration ?? []), type],
    }));
  };

  // Helper: Remove item by index
  const removeCalibration = (index: number) => {
    setTask((prev) => ({ ...prev, calibration: (prev.calibration ?? []).filter((_, i) => i !== index) }));
  };

  // Helper: Handle Drag & Drop Reordering
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('draggedIndex', index.toString());
  };

  const getCalibrationName = (type: CalibrationType) => {
    if (type === CalibrationType.FlipAngle) { return "Power calibration" }
    if (type === CalibrationType.Frequency) { return "Frequency calibration" }
    if (type === CalibrationType.Shims) { return "Shim calibration" }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    const draggedIndex = parseInt(e.dataTransfer.getData('draggedIndex'));
    if (draggedIndex === targetIndex) return;

    const newCalibration = [...(task.calibration ?? [])];
    const [draggedItem] = newCalibration.splice(draggedIndex, 1);
    newCalibration.splice(targetIndex, 0, draggedItem);

    setTask({ ...task, calibration: newCalibration });
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();



  return (
    <>
      <Typography id='basic-modal-dialog-title' component='h2' level='inherit' fontSize='1.25em' mb='0.25em'>
        {title}
      </Typography>

      <Grid container rowSpacing={2} columnSpacing={5}>

        {/* Name */}
        <Grid md={6}>
          <Stack spacing={1}>
            <FormLabel>Name</FormLabel>
            <Input
              name={'name'}
              onChange={(e) => setTask({ ...task, [e.target.name]: e.target.value })}
              value={task.name}
            />
          </Stack>
        </Grid>

        {/* Sequence */}
        <Grid md={6}>
          <Stack spacing={1}>
            <FormLabel>Sequence</FormLabel>
            <Select
              value={task.sequence_id ? task.sequence_id : null}
              placeholder={'Select a sequence...'}
              size='sm'
              onChange={(_, value) => {
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
        </Grid>

        {/* Description */}
        <Grid md={6}>
          <Stack spacing={1}>
            <FormLabel>Description</FormLabel>
            <Textarea
              minRows={2}
              name={'description'}
              onChange={(e) => setTask({ ...task, [e.target.name]: e.target.value })}
              defaultValue={task.description}
            />
          </Stack>
        </Grid>

        {/* Device */}
        <Grid md={6}>
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
        </Grid>

        <Grid md={6}>
          <Stack spacing={1}>
            <FormLabel>Calibration</FormLabel>
            <Stack direction='row' spacing={3}>
              {/* Buttons: Add calibration steps */}
              <Stack direction="column" spacing={1}>
                <Button
                  size="sm"
                  variant="outlined"
                  startDecorator={<AddIcon sx={{ fontSize: 'var(--IconFontSize)' }} />}
                  onClick={() => addCalibration(CalibrationType.Frequency)}
                >
                  Frequency
                </Button>
                <Button
                  size="sm"
                  variant="outlined"
                  startDecorator={<AddIcon sx={{ fontSize: 'var(--IconFontSize)' }} />}
                  onClick={() => addCalibration(CalibrationType.FlipAngle)}
                >
                  Flip Angle
                </Button>
                <Button
                  size="sm"
                  variant="outlined"
                  startDecorator={<AddIcon sx={{ fontSize: 'var(--IconFontSize)' }} />}
                  onClick={() => addCalibration(CalibrationType.Shims)}
                >
                  Shims
                </Button>
              </Stack>

              {/* Vertical Drag+Drop Container */}
              <Sheet
                variant="outlined"
                sx={{
                  borderRadius: 'md',
                  p: 1.5,
                  height: 240,
                  width: 300,
                  display: 'flex',
                  flexDirection: 'column', // Maintains the list structure
                  gap: 1, // Vertical spacing between items
                  overflowY: 'auto',
                  // Style scrollbar
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'var(--joy-palette-neutral-outlinedBorder) transparent', // For Firefox
                  '&::-webkit-scrollbar-track': { background: 'transparent' },
                }}
              >
                {(task.calibration?.length ?? 0) === 0 && (
                  <Typography level="body-sm" sx={{ m: 'auto', color: 'text.tertiary' }}>
                    No calibrations added.
                  </Typography>
                )}
                {(task.calibration ?? []).map((type, index) => (
                  <Chip
                    key={`${type}-${index}`}
                    size="sm"
                    color="primary"
                    draggable // The chip is now the drag handle
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    endDecorator={
                      <ChipDelete sx={{ marginLeft: 1, marginRight: 0.1 }} onDelete={() => removeCalibration(index)} />
                    }
                    sx={{
                      width: '100%',
                      flexShrink: 0,
                      cursor: 'grab',
                      '&:active': { cursor: 'grabbing' },
                      px: 1.5,
                      py: 0.5
                    }}
                  >
                    <Typography level="title-sm">{index + 1}. {getCalibrationName(type)}</Typography>
                  </Chip>
                ))}
              </Sheet>
            </Stack>
          </Stack>
        </Grid>

        {/* FoV Configuration */}
        <Grid md={6}>
          <Stack spacing={2}>

            {/* FoV Scaling */}
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
                      slotProps={{ input: { min: 0, max: 100 } }}
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

            {/* FoV Rotation */}
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
                      slotProps={{ input: { min: 0, max: 360 } }}
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

            {/* FoV Offset */}
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
                      slotProps={{ input: { min: -10000, max: 10000 } }}
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
          </Stack>
        </Grid>

        {/* Save button */}
        <Grid md={12} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            size='sm'
            sx={{ maxWidth: 120 }}
            onClick={(event) => {
              event.preventDefault()
              if (task.name == '') {
                showNotification({ message: 'Task name must not be empty.', type: 'warning' })
              }
              else if (task.description == '') {
                showNotification({ message: 'Task description must not be empty.', type: 'warning' })
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
    </>
  )
}


function DagTaskForm(props: ModalPropsCreate | ModalPropsModify<DAGTaskOut>) {
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
        dag_type: TaskType.Processing,
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
              showNotification({ message: 'Updated DAG task.', type: 'success' })
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
              showNotification({ message: 'Created DAG task.', type: 'success' })
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

      <Grid container rowSpacing={2} columnSpacing={5}>
        <Grid md={6}>
          <FormLabel>Name</FormLabel>
          <Input
            name={'name'}
            onChange={(e) => setTask({ ...task, [e.target.name]: e.target.value })}
            value={task.name}
          />
        </Grid>

        <Grid md={6}>
          <FormLabel>Description</FormLabel>
          <Textarea
            minRows={2}
            name={'description'}
            onChange={(e) => setTask({ ...task, [e.target.name]: e.target.value })}
            defaultValue={task.description}
          />
        </Grid>

        {/* DAG selection */}
        <Grid md={6}>
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

        {/* <Grid md={6}>
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
        </Grid> */}

        <Grid md={6}>
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

        {/* Save button */}
        <Grid md={12} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            size='sm'
            sx={{ maxWidth: 120 }}
            onClick={(event) => {
              event.preventDefault()
              if (task.name == '') {
                showNotification({ message: 'Task name must not be empty.', type: 'warning' })
              }
              else if (task.description == '') {
                showNotification({ message: 'Task description must not be empty.', type: 'warning' })
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
        sx={{ width: '60vw', maxHeight: 'calc(100vh - 2 * var(--Navigation-height))', height: '80vh', borderRadius: 'md', p: 5, overflow: 'auto' }}
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
