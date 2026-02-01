/**
 * Copyright (C) 2024, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
 * SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial
 *
 * TemplatesView.tsx is responsible for rendering all existing template items
 * and allows to add new templates or edit existing templates.
 */
import Add from '@mui/icons-material/Add'
import Box from '@mui/joy/Box'
import Button from '@mui/joy/Button'
import Stack from '@mui/joy/Stack'
import React from 'react'
import { useQuery } from '@tanstack/react-query'

import { examApi, taskApi } from '../api'
import { ExamOut, WorkflowOut } from '../openapi/generated-client/exam'
import ExamModal from '../components/ExamModal'
import ExamItem, { ExamMenu } from '../components/ExamItem'
import WorkflowItem, { WorkflowMenu } from '../components/WorkflowItem'
import Typography from '@mui/joy/Typography'
import TaskItem from '../components/TaskItem'
import { ITEM_UNSELECTED } from '../interfaces/components.interface'
import WorkflowModal from '../components/WorkflowModal'
import TaskModal from '../components/TaskModal'


export default function TemplatesView() {
  const [examModalOpen, setExamModalOpen] = React.useState(false)
  const [workflowModalOpen, setWorkflowModalOpen] = React.useState(false)
  const [taskModalOpen, setTaskModalOpen] = React.useState(false)

  const [selectedExam, setSelectedExam] = React.useState<undefined | number>(undefined)
  const [selectedWorkflow, setSelectedWorkflow] = React.useState<undefined | number>(undefined)
  const [draggingTaskIndex, setDraggingTaskIndex] = React.useState<number | undefined>(undefined)

  const handleDragStart = (index: number) => {
    setDraggingTaskIndex(index)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (index: number) => {
    if (
      draggingTaskIndex === undefined ||
      draggingTaskIndex === index ||
      selectedExam === undefined ||
      selectedWorkflow === undefined ||
      !exams
    )
      return

    const tasks = [...exams[selectedExam].workflows[selectedWorkflow].tasks]
    const [draggedTask] = tasks.splice(draggingTaskIndex, 1)
    tasks.splice(index, 0, draggedTask)

    const taskIds = tasks.map((t) => t.id)
    await taskApi.reorderTasksApiV1ExamTaskReorderPut({ task_ids: taskIds })
    refetchExams()
    setDraggingTaskIndex(undefined)
  }

  // Reset selectedWorkflow and selectedTask when selectedExam changes to undefined
  React.useEffect(() => {
    if (!selectedExam) {
      setSelectedWorkflow(undefined)
    }
  }, [selectedExam])


  const { data: exams, refetch: refetchExams } = useQuery<ExamOut[]>({
    queryKey: ['allExamTemplates'],
    queryFn: async () => {
      return await examApi
        .getAllExamTemplatesApiV1ExamTemplatesAllGet()
        .then((result) => {
          return result.data
        })
    },
  })

  return (
    <Stack direction="row" alignItems="flex-start" width='100vw'>

      <Stack direction='column' alignContent='center' flex={1} spacing={2} sx={{ p: 2 }}>
        {/* <Button startDecorator={<Add />} onClick={() => setExamModalOpen(true)}>
          Create Exam Template
        </Button> */}
        <Stack direction='row' sx={{ justifyContent: 'space-between', mb: 1, alignItems: 'center' }}>
          <Typography level='title-md'>Exam Templates</Typography>
          <Button
            variant='outlined'
            startDecorator={<Add sx={{ fontSize: 'var(--IconFontSize)' }} />}
            onClick={() => setExamModalOpen(true)}>
            Create Exam
          </Button>
        </Stack>

        <ExamModal
          isOpen={examModalOpen}
          setOpen={setExamModalOpen}
          onSubmit={() => refetchExams()}
          modalType='create'
          createTemplate={true}
          parentId={undefined}
        />
        {
          exams?.map((exam, index) => (
            <Stack direction="row" key={`exam-${exam.id}`} gap={1}>
              <ExamItem
                item={exam}
                onClick={() => { selectedExam === index ? setSelectedExam(undefined) : setSelectedExam(index) }}
                selection={selectedExam === index ? {
                  type: 'exam',
                  name: exams[index].name,
                  itemId: exams[index].id,
                  status: exams[index].status
                } : ITEM_UNSELECTED}
              />
              <ExamMenu item={exam} refetchParentData={refetchExams} />
            </Stack>
          ))
        }
      </Stack>

      <Stack direction='column' alignContent='center' flex={1} spacing={2} sx={{ p: 2 }}>
        {/* <Button startDecorator={<Add />} onClick={() => setWorkflowModalOpen(true)} disabled={selectedExam === undefined}>
          Create Workflow Template
        </Button> */}
        <Stack direction='row' sx={{ justifyContent: 'space-between', mb: 1, alignItems: 'center' }}>
          <Typography level='title-md'>Workflow Templates</Typography>
          <Button
            variant='outlined'
            startDecorator={<Add sx={{ fontSize: 'var(--IconFontSize)' }} />}
            onClick={() => setWorkflowModalOpen(true)}
            disabled={selectedExam === undefined}
          >
            Create Workflow
          </Button>
        </Stack>

        <WorkflowModal
          isOpen={workflowModalOpen}
          setOpen={setWorkflowModalOpen}
          onSubmit={() => refetchExams()}
          modalType='create'
          createTemplate={true}
          parentId={exams && selectedExam !== undefined ? exams[selectedExam].id : undefined}
        />
        {
          exams && selectedExam !== undefined && exams[selectedExam]?.workflows?.map((workflow: WorkflowOut, index: number) => (
            <Stack direction="row" key={`workflow-${workflow.id}`}>
              <WorkflowItem
                item={workflow}
                onClick={() => { selectedWorkflow === index ? setSelectedWorkflow(undefined) : setSelectedWorkflow(index) }}
                selection={selectedWorkflow === index ? {
                  type: 'workflow',
                  name: exams[selectedExam].workflows[index].name,
                  itemId: exams[selectedExam].workflows[index].id,
                  status: exams[selectedExam].workflows[index].status
                } : ITEM_UNSELECTED}
              />
              <WorkflowMenu item={workflow} refetchParentData={refetchExams} />
            </Stack>
          ))
        }
      </Stack>

      <Stack direction='column' alignContent='center' flex={1} spacing={2} sx={{ p: 2 }}>
        {/* <Button startDecorator={<Add />} onClick={() => setTaskModalOpen(true)} disabled={selectedWorkflow === undefined}>
          Create Task Template
        </Button> */}
        <Stack direction='row' sx={{ justifyContent: 'space-between', mb: 1, alignItems: 'center' }}>
          <Typography level='title-md'>Task Templates</Typography>
          <Button
            variant='outlined'
            startDecorator={<Add sx={{ fontSize: 'var(--IconFontSize)' }} />}
            onClick={() => setTaskModalOpen(true)}
            disabled={selectedWorkflow === undefined}
          >
            Create Task
          </Button>
        </Stack>

        <TaskModal
          isOpen={taskModalOpen}
          setOpen={setTaskModalOpen}
          onSubmit={() => refetchExams()}
          modalType='create'
          createTemplate={true}
          parentId={exams && selectedExam !== undefined && selectedWorkflow !== undefined ? exams[selectedExam].workflows[selectedWorkflow].id : undefined}
        />
        {
          exams && selectedExam !== undefined && selectedWorkflow !== undefined && exams[selectedExam].workflows[selectedWorkflow]?.tasks?.map((task, index) => (
            <Box
              key={`task-${task.id}`}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(index)}
              sx={{
                cursor: 'grab',
                '&:active': { cursor: 'grabbing' },
                opacity: draggingTaskIndex === index ? 0.5 : 1,
              }}
            >
              <TaskItem
                item={task}
                refetchParentData={refetchExams}
                onClick={() => { }}
                selection={ITEM_UNSELECTED}
              />
            </Box>
          ))
        }
      </Stack>

    </Stack>
  )
}