import STTNode from './STTNode';
import ShotDetectionNode from './ShotDetectionNode';
import AIDirectorNode from './AIDirectorNode';
import AssemblyNode from './AssemblyNode';
import ExportNode from './ExportNode';

export {
  STTNode,
  ShotDetectionNode,
  AIDirectorNode,
  AssemblyNode,
  ExportNode,
};

export const nodeTypes = {
  sttNode: STTNode,
  shotDetectionNode: ShotDetectionNode,
  aiDirectorNode: AIDirectorNode,
  assemblyNode: AssemblyNode,
  exportNode: ExportNode,
};