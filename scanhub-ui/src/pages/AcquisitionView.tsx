/**
 * Copyright (C) 2024, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
 * SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial
 *
 * AcquisitionView.tsx is responsible for rendering the acquisition view.
 * The acquisition view is the main interaction point and contains instances of
 * exams, workflows and tasks of a certain patients.
 * It allows to execute them and view results, i.e. dicom images.
 */
import AddSharpIcon from '@mui/icons-material/AddSharp'
import Badge from '@mui/joy/Badge'
import Box from '@mui/joy/Box'
import Divider from '@mui/joy/Divider'
import IconButton from '@mui/joy/IconButton'
import Sheet from '@mui/joy/Sheet'
import Typography from '@mui/joy/Typography'
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'

import { examApi, patientApi } from '../api'
import AcquisitionControl from '../components/AcquisitionControl'
import ConfirmAcquisitionLimitsModal from '../components/AcquisitionLimitsModal'
// import DicomViewer from '../components/DicomViewer'
import DicomViewer3D from '../viewer/dicom/DicomViewer'
import RawDataViewer from '../viewer/mrd/RawDataViewer'
import PatientInfo from '../components/PatientInfo'
import { PatientOut } from '../openapi/generated-client/patient'
import { ExamOut, TaskType, WorkflowOut, AcquisitionTaskOut, DAGTaskOut } from '../openapi/generated-client/exam'
import ExamFromTemplateModal from '../components/ExamFromTemplateModal'
import AccordionWithMenu from '../components/AccordionWithMenu'
import ExamItem, { ExamMenu } from '../components/ExamItem'
import WorkflowItem, { WorkflowMenu } from '../components/WorkflowItem'
import TaskItem from '../components/TaskItem'
import { ITEM_UNSELECTED, ItemSelection } from '../interfaces/components.interface'
import Container from '@mui/joy/Container'
import AlertItem from '../components/AlertItem'
import { Alerts } from '../interfaces/components.interface'
import ExamInfo from '../components/ExamInfo'
import WorkflowInfo from '../components/WorkflowInfo'


function AcquisitionView() {
  const params = useParams()

  const [examFromTemplateModalOpen, setExamFromTemplateModalOpen] = React.useState(false)
  const [confirmAcquisitionLimitsModalOpen, setConfirmAcquisitionLimitsModalOpen] = React.useState(false)
  const [itemSelection, setItemSelection] = React.useState<ItemSelection>(ITEM_UNSELECTED)
  const [onAcquisitionLimitsConfirm, setOnAcquisitionLimitsConfirm] = React.useState<() => void>(() => () => {});
  // const [, showNotification] = React.useContext(NotificationContext)
  

  // useQuery for caching the fetched data
  const {
    data: patient,
    refetch: refetchPatient,
    isLoading: patientLoading,
    isError: patientError,
  } = useQuery<PatientOut>({
    queryKey: ['patient', params.patientId],
    queryFn: async () => {
      return await patientApi.getPatientApiV1PatientPatientIdGet(params.patientId!)
      .then((result) => {
        return result.data
      })
    },
    refetchInterval: 1000
  })

  // Query all exams of the patient
  const {
    data: exams,
    refetch: refetchExams,
    // isLoading: examsLoading,
    // isError: examsError,
  } = useQuery<ExamOut[], Error>({
    queryKey: ['allExams', params.patientId],
    queryFn: async () => {
      return await examApi.getAllPatientExamsApiV1ExamAllPatientIdGet(params.patientId!)
        .then((result) => {
          if (itemSelection.itemId != undefined) {
            result.data.map((exam) => {
              if (exam.id == itemSelection.itemId) {
                setItemSelection({ type: 'exam', name: exam.name, itemId: exam.id, status: exam.status, progress: 0 })
              }
              exam.workflows.map((workflow) => {
                if (workflow.id == itemSelection.itemId) {
                  setItemSelection({ type: 'workflow', name: workflow.name, itemId: workflow.id, status: workflow.status, progress: 0 })
                }
                workflow.tasks.map((task) => {
                  if (task.id == itemSelection.itemId) {
                    setItemSelection({
                      type: task.task_type == TaskType.Acquisition ? 'ACQUISITION' : 'DAG',
                      name: task.name,
                      itemId: task.id,
                      status: task.status,
                      progress: task.progress
                    })
                  }
                })
              })
            })
          }
          return result.data
        })
    },
    refetchInterval: 1000
  })

  if (patientError || patient == undefined) {
    // Catch undefined patient
    return (
      <Container maxWidth={false} sx={{ width: '50%', mt: 5, justifyContent: 'center' }}>
        <AlertItem title='Error getting patient information / patient undefined.' type={Alerts.Error} />
      </Container>
    )
  }

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
      }}
    >
      <Sheet
        className='Sidebar'
        sx={{
          position: { xs: 'fixed', md: 'sticky' },
          height: '100%',
          width: 'var(--Sidebar-width)',
          top: 0,
          p: 2,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          borderRight: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Typography level='title-md'>Patient Info</Typography>
        </Box>
        <Divider />
        <PatientInfo patient={patient} isLoading={patientLoading} isError={patientError} />

        {/* <ListDivider /> */}
        <Divider />

        {/* Exam header */}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Typography level='title-md'>Exams</Typography>
            <Badge badgeContent={exams?.length} color='primary' />
          </Box>

          <IconButton size='sm' variant='plain' color='neutral' onClick={() => setExamFromTemplateModalOpen(true)}>
            <AddSharpIcon />
          </IconButton>
        </Box>

        <Divider />

        <Box
          sx={{
            minHeight: 0,
            overflow: 'hidden auto',
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {exams?.map((exam: ExamOut) => (
            <AccordionWithMenu 
              key={`exam-${exam.id}`}
              accordionSummary={
                <ExamItem 
                  item={exam} 
                  onClick={() => {setItemSelection({type: 'exam', name: exam.name, itemId: exam.id, status: exam.status, progress: 0})}} 
                  selection={itemSelection}
                />
              }
              accordionMenu={ <ExamMenu item={exam} refetchParentData={refetchExams} /> }
              toolTipContent={ <ExamInfo exam={exam} /> }
            >
              {exam.workflows?.map((workflow: WorkflowOut) => (
                <AccordionWithMenu 
                  key={`workflow-${workflow.id}`}
                  accordionSummary={
                    <WorkflowItem 
                      item={workflow} 
                      onClick={() => {setItemSelection({type: 'workflow', name: workflow.name, itemId: workflow.id, status: workflow.status, progress: 0})}}
                      selection={itemSelection}
                    />
                  }
                  accordionMenu={<WorkflowMenu item={workflow} refetchParentData={refetchExams} />}
                  toolTipContent={<WorkflowInfo workflow={workflow} />}
                >
                  {workflow.tasks?.sort((taskA, taskB) => {
                    let a: number = 4
                    let b: number = 4
                    if (taskA.task_type == TaskType.Acquisition) a = 1;
                    if (taskA.task_type == TaskType.Dag) a = 2;
                    if (taskA.dag_type && taskA.dag_type == TaskType.Processing) a = 3;
                    if (taskB.task_type == TaskType.Acquisition) b = 1;
                    if (taskB.task_type == TaskType.Dag) b = 2;
                    if (taskB.dag_type && taskB.dag_type == TaskType.Processing) b = 3;
                    return a - b
                  }).map((task: AcquisitionTaskOut | DAGTaskOut) => (
                    <TaskItem 
                      key={`task-${task.id}`} 
                      item={task} 
                      refetchParentData={refetchExams}
                      onClick={() => {setItemSelection({
                        type: task.task_type == TaskType.Acquisition ? 'ACQUISITION' : 'DAG',
                        name: task.name,
                        itemId: task.id,
                        status: task.status,
                        progress: task.progress
                      })}}
                      selection={itemSelection}
                    />
                  ))}
                </AccordionWithMenu>
              ))}
            </AccordionWithMenu>
          ))}
        </Box>

        <Divider />
        
        <ConfirmAcquisitionLimitsModal
          item={patient}
          isOpen={confirmAcquisitionLimitsModalOpen}
          setOpen={setConfirmAcquisitionLimitsModalOpen}
          onSubmit={() => {
            refetchPatient()
            onAcquisitionLimitsConfirm()
          }}
        />     

        <AcquisitionControl 
          itemSelection={itemSelection}
          openConfirmModal={(callback: () => void) => {
            if (itemSelection.type == 'ACQUISITION'){
              // Only require confirmation in case of acquisition tasks
              setOnAcquisitionLimitsConfirm(() => callback);
              setConfirmAcquisitionLimitsModalOpen(true);
            }
            else {
              callback()
            }
          }}
        />

      </Sheet>

      <ExamFromTemplateModal
        isOpen={examFromTemplateModalOpen}
        setOpen={setExamFromTemplateModalOpen}
        parentId={String(params.patientId)}
        onSubmit={refetchExams}
        createTemplate={false}
        modalType={'create'}
      />

      {
        itemSelection.itemId && itemSelection.type == 'ACQUISITION' ? <RawDataViewer item={itemSelection}/> :
          <DicomViewer3D item={itemSelection}/>
      }
    </Box>
  )
}

export default AcquisitionView
