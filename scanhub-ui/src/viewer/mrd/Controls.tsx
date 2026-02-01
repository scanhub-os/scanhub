import React from 'react';
import type { ColorPalette, ComplexMode } from './types';
import Checkbox from '@mui/joy/Checkbox';
import Switch from '@mui/joy/Switch';
import Select from '@mui/joy/Select';
import Option from '@mui/joy/Option';
import FormLabel from '@mui/joy/FormLabel'
// import Slider from '@mui/joy/Slider';
import Box from '@mui/joy/Box';
import Input from '@mui/joy/Input';
import Stack from '@mui/joy/Stack';
import IconButton from '@mui/joy/IconButton';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { ResultOut } from '../../openapi/generated-client/exam';
import { plotColorPaletteOptions, plotColorPalettes } from './utils/colormaps';


export interface ControlsProps {
  metaCount: number;
  results: ResultOut[];
  selectedResultId: string;
  setSelectedResultId: (v: string) => void;
  overlay: boolean;
  setOverlay: (v: boolean) => void;
  wantTime: boolean;
  setWantTime: (v: boolean) => void;
  wantFreq: boolean;
  setWantFreq: (v: boolean) => void;
  mode: ComplexMode;
  setMode: (v: ComplexMode) => void;
  colorPalette: ColorPalette;
  setColorPalette: (v: ColorPalette) => void;
  coil: number;
  setCoil: (v: number) => void;
  acqRange: [number, number];
  setAcqRange: (v: [number, number]) => void;
  currentAcq: number;
  setCurrentAcq: (v: number) => void;
  onDownload: () => void;
}

export default function Controls(p: ControlsProps) {
  const maxIdx = Math.max(0, p.metaCount - 1);

  return (

    <Stack direction={'row'} sx={{ alignItems: 'center', justifyContent: 'flex-start' }} gap={2}>

      <Stack direction="row" gap={1} alignItems="center">
        <Select
          size="sm"
          value={p.selectedResultId}
          onChange={(_, value) => value && p.setSelectedResultId(value)}
          required
          sx={{ minWidth: 200 }}
        >
          {
            p.results.map((result => {
              const date_time = new Date(result.datetime_created)
              return (
                <Option key={result.id} id={result.id} value={result.id}>
                  {(result.files ? result.files[0] + ' | ' : '') + date_time.toLocaleDateString() + ', ' + date_time.toLocaleTimeString()}
                </Option>
              )
            }))
          }
        </Select>
        <IconButton
          size="sm"
          variant="outlined"
          color="neutral"
          title="Download MRD"
          onClick={p.onDownload}
        >
          <FileDownloadIcon sx={{ fontSize: 'var(--IconFontSize)' }} />
        </IconButton>
      </Stack>

      <Box sx={{ display: 'flex', gap: 2 }}>
        {/* <FormLabel>Domain</FormLabel> */}
        <Checkbox label="Time" size="sm" checked={p.wantTime} onChange={e => p.setWantTime(e.target.checked)} />
        <Checkbox label="Frequency" size="sm" checked={p.wantFreq} onChange={e => p.setWantFreq(e.target.checked)} />
      </Box>

      <Select
        size="sm"
        value={p.mode}
        defaultValue={'abs'}
        onChange={(_, value) => p.setMode(value as ComplexMode)}
        required
      >
        <Option value="abs">Magnitude</Option>
        <Option value="phase">Phase</Option>
        <Option value="real">Real</Option>
        <Option value="imag">Imag</Option>
      </Select>

      {/* <FormLabel>Colormap</FormLabel> */}
      <FormLabel>Color</FormLabel>
      <Select
        size="sm"
        value={p.colorPalette.id}
        defaultValue={plotColorPalettes.default.id}
        onChange={(_, value) => p.setColorPalette(plotColorPalettes[value ? value : plotColorPalettes.default.id])}
        required
      >
        {
          plotColorPaletteOptions.map((p) => (
            <Option key={p.id} value={p.id}>
              {p.name}
            </Option>
          ))
        }
      </Select>

      <FormLabel>Coil</FormLabel>
      <Input
        size="sm"
        type="number"
        value={p.coil}
        slotProps={{ input: { min: 0, max: 999, step: 1 } }}
        onChange={(e) => p.setCoil(Math.max(0, Number(e.target.value)))}
      />

      <FormLabel>Plot</FormLabel>
      <Switch size="sm" checked={p.overlay} onChange={e => p.setOverlay(e.target.checked)} />

      {/* <Slider
        getAriaLabel={() => 'Acquisition range'}
        min={0}
        max={maxIdx}
        step={1}
        value={p.acqRange}
        onChange={(_, value) => p.setAcqRange(value as [number, number])}
        valueLabelDisplay="auto"
      /> */}
      {
        p.overlay ?
          <Stack direction={'row'} gap={1}>
            <FormLabel>Range</FormLabel>
            <Input
              size="sm"
              type="number"
              value={p.acqRange[0]}
              slotProps={{ input: { min: 0, max: maxIdx, step: 1 } }}
              onChange={(e) => p.setAcqRange([Math.max(0, Number(e.target.value)), p.acqRange[1]])}
            />
            <Input
              size="sm"
              type="number"
              value={p.acqRange[1]}
              slotProps={{ input: { min: 0, max: maxIdx, step: 1 } }}
              onChange={(e) => p.setAcqRange([p.acqRange[0], Math.min(maxIdx, Number(e.target.value))])}
            />
          </Stack> :
          <Stack direction={'row'} gap={1}>
            <FormLabel>Readout</FormLabel>
            <Input
              size="sm"
              type="number"
              value={p.currentAcq}
              slotProps={{ input: { min: 0, max: maxIdx, step: 1 } }}
              onChange={(e) => p.setCurrentAcq(Math.max(0, Math.min(maxIdx, Number(e.target.value))))}
            />
          </Stack>
      }
    </Stack>
  );
}
