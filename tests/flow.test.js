const test = require('node:test');
const assert = require('node:assert/strict');
const { defaultFlow, defaultContentForAction } = require('../src/flow/defaults');
const { createNode, deleteSubtree, moveSibling, getPath, validateFlow } = require('../src/flow/model');


test('flow can add nested buttons and compute path', () => {
  const flow = defaultFlow();
  const a = createNode(flow, 'root', 'Role', 'menu', defaultContentForAction('menu'));
  const b = createNode(flow, a.id, 'Fantasy', 'menu', defaultContentForAction('menu'));
  const c = createNode(flow, b.id, 'Wizard', 'chat', defaultContentForAction('chat'));
  assert.deepEqual(getPath(flow, c.id), ['Role', 'Fantasy', 'Wizard']);
  assert.deepEqual(validateFlow(flow), []);
});


test('subtree deletion removes descendants and parent link', () => {
  const flow = defaultFlow();
  const a = createNode(flow, 'root', 'A', 'menu', defaultContentForAction('menu'));
  const b = createNode(flow, a.id, 'B', 'message', defaultContentForAction('message'));
  deleteSubtree(flow, a.id);
  assert.equal(flow.nodes[a.id], undefined);
  assert.equal(flow.nodes[b.id], undefined);
  assert.deepEqual(flow.nodes.root.children, []);
});


test('siblings can be reordered', () => {
  const flow = defaultFlow();
  const a = createNode(flow, 'root', 'A', 'menu', null);
  const b = createNode(flow, 'root', 'B', 'menu', null);
  assert.deepEqual(flow.nodes.root.children, [a.id, b.id]);
  assert.equal(moveSibling(flow, b.id, 'up'), true);
  assert.deepEqual(flow.nodes.root.children, [b.id, a.id]);
});
