/**
 * Copyright (C) 2024, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
 * SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial
 *
 * WorkflowModal.tsx is responsible for rendering a modal with an interface
 * to create a new workflow or to modify an existing modal.
 */
import Button from '@mui/joy/Button'
import FormLabel from '@mui/joy/FormLabel'
import Input from '@mui/joy/Input'
import Modal from '@mui/joy/Modal'
import ModalClose from '@mui/joy/ModalClose'
import ModalDialog from '@mui/joy/ModalDialog'
import Stack from '@mui/joy/Stack'
import Typography from '@mui/joy/Typography'
import React from 'react'
import { useMutation } from '@tanstack/react-query'

import { workflowsApi } from '../api'
import { BaseWorkflow, WorkflowOut } from '../openapi/generated-client/exam'
import { ModalPropsCreate, ModalPropsModify } from '../interfaces/components.interface'
import NotificationContext from '../NotificationContext'


function WorkflowForm(props: ModalPropsCreate | ModalPropsModify<WorkflowOut>) {
  // The form is in this separate component to make sure that the state is reset after closing the modal

  const initialWorkflow: BaseWorkflow = props.modalType == 'modify' ?
  {...props.item, status: 'UPDATED'}
:
  {
    name: '',
    description: '',
    comment: undefined,
    exam_id: props.parentId,                // eslint-disable-line camelcase
    status: 'NEW',
    is_template: props.createTemplate,      // eslint-disable-line camelcase
  }

  const [workflow, setWorkflow] = React.useState<BaseWorkflow>(initialWorkflow);

  const [, showNotification] = React.useContext(NotificationContext)

  const mutation = 
  props.modalType == 'modify' ?
      useMutation({
        mutationFn: async () => {
          await workflowsApi.updateWorkflowApiV1ExamWorkflowWorkflowIdPut(props.item.id, workflow)
          .then(() => {
            props.onSubmit()
            showNotification({message: 'Updated Workflow.', type: 'success'})
          })
        }
      })
    :
      useMutation({
        mutationFn: async () => {
          await workflowsApi.createWorkflowApiV1ExamWorkflowNewPost(workflow)
          .then(() => {
            props.onSubmit()
            showNotification({message: 'Created Workflow.', type: 'success'})
          })
        }
      })

  const title = 'item' in props ? 'Update Workflow' : 'Create New Workflow'

  return (
    <>
      <Typography id='basic-modal-dialog-title' component='h2' level='inherit' fontSize='1.25em' mb='0.25em'>
        {title}
      </Typography>

      <Stack spacing={1}>
        <FormLabel>Name</FormLabel>
        <Input
          name={'name'}
          onChange={(e) => setWorkflow({ ...workflow, [e.target.name]: e.target.value })}
          defaultValue={workflow.name}
          placeholder='Name of the workflow'
        />

        <FormLabel>Description</FormLabel>
        <Input
          name={'description'}
          onChange={(e) => setWorkflow({ ...workflow, [e.target.name]: e.target.value })}
          defaultValue={workflow.description}
          required={true}
          placeholder='Description of the workflow'
        />

        {
          !workflow.is_template ? 
            <>
              <FormLabel>Comment</FormLabel>
              <Input
                name={'comment'}
                onChange={(e) => setWorkflow({ ...workflow, [e.target.name]: e.target.value })}
              />
            </>
          :
            undefined
        }

        <Button
          size='sm'
          sx={{ maxWidth: 120 }}
          onClick={(event) => {
            event.preventDefault()
            if (workflow.name == '') {
              showNotification({message: 'Workflow name must not be empty.', type: 'warning'})
            }
            else if (workflow.description == '') {
              showNotification({message: 'Workflow description must not be empty.', type: 'warning'})
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


export default function WorkflowModal(props: ModalPropsCreate | ModalPropsModify<WorkflowOut>) {
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
        sx={{ width: '50vw', borderRadius: 'md', p: 5 }}
      >
        <ModalClose
          sx={{
            top: '10px',
            right: '10px',
            borderRadius: '50%',
            bgcolor: 'background.body',
          }}
        />
        <WorkflowForm {...props} />
      </ModalDialog>
    </Modal>
  )
}
