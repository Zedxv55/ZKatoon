import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WORKFLOW_TEMPLATES,
  autoLayoutWorkflowNodes,
  computeTopologicalLevels,
} from './workflowRegistry.ts';

test('Topological DAG level grouping preserves dependencies and parallel branches', () => {
  const tpl = WORKFLOW_TEMPLATES[0];
  const res = computeTopologicalLevels(tpl.nodes, tpl.edges);
  assert.equal(res.ok, true);
  if (!res.ok) return;

  // Level 0: input_topic (n1)
  assert.deepEqual(
    res.levels[0].map((n) => n.id),
    ['n1']
  );
  // Level 1: ai_script_brain (n2)
  assert.deepEqual(
    res.levels[1].map((n) => n.id),
    ['n2']
  );
  // Level 2: parallel independent branches char_designer (n3) and audio_tts_voice (n4)
  assert.deepEqual(
    res.levels[2].map((n) => n.id).sort(),
    ['n3', 'n4']
  );
  // Last level: video_render_qa (n6)
  assert.deepEqual(
    res.levels[res.levels.length - 1].map((n) => n.id),
    ['n6']
  );
});

test('Cycle detection rejects circular workflow graphs cleanly', () => {
  const tpl = WORKFLOW_TEMPLATES[0];
  const cyclicEdges = [...tpl.edges, { id: 'cycle', source: 'n6', target: 'n2' }];
  const res = computeTopologicalLevels(tpl.nodes, cyclicEdges);
  assert.equal(res.ok, false);
});

test('Auto-layout arranges nodes cleanly left-to-right by DAG level', () => {
  const tpl = WORKFLOW_TEMPLATES[1];
  const laidOut = autoLayoutWorkflowNodes(tpl.nodes, tpl.edges);
  const startNode = laidOut.find((n) => n.id === 'm1')!;
  const endNode = laidOut.find((n) => n.id === 'm6')!;
  assert.ok(endNode.position.x > startNode.position.x);
});
