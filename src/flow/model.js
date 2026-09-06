const crypto = require('crypto');

function newNodeId() {
  return crypto.randomBytes(5).toString('hex');
}

function getNode(flow, nodeId) {
  return flow?.nodes?.[nodeId] || null;
}

function getChildren(flow, node) {
  return (node?.children || []).map((id) => flow.nodes[id]).filter(Boolean);
}

function createNode(flow, parentId, label, action, content) {
  const parent = getNode(flow, parentId);
  if (!parent) throw new Error('Parent node not found.');

  let id = newNodeId();
  while (flow.nodes[id]) id = newNodeId();

  flow.nodes[id] = {
    id,
    parentId,
    label,
    action,
    content,
    afterAnswerContent: null,
    children: [],
  };
  parent.children = parent.children || [];
  parent.children.push(id);
  return flow.nodes[id];
}

function deleteSubtree(flow, nodeId) {
  if (nodeId === flow.rootId) throw new Error('The root node cannot be deleted.');
  const node = getNode(flow, nodeId);
  if (!node) return;

  for (const childId of [...(node.children || [])]) {
    deleteSubtree(flow, childId);
  }

  const parent = getNode(flow, node.parentId);
  if (parent) parent.children = (parent.children || []).filter((id) => id !== nodeId);
  delete flow.nodes[nodeId];
}

function moveSibling(flow, nodeId, direction) {
  const node = getNode(flow, nodeId);
  if (!node || !node.parentId) return false;
  const parent = getNode(flow, node.parentId);
  if (!parent) return false;

  const children = parent.children || [];
  const index = children.indexOf(nodeId);
  if (index < 0) return false;
  const nextIndex = direction === 'up' ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= children.length) return false;

  [children[index], children[nextIndex]] = [children[nextIndex], children[index]];
  return true;
}

function getPath(flow, nodeId) {
  const path = [];
  let node = getNode(flow, nodeId);
  const seen = new Set();
  while (node && !seen.has(node.id)) {
    seen.add(node.id);
    if (node.id !== flow.rootId) path.unshift(node.label);
    node = node.parentId ? getNode(flow, node.parentId) : null;
  }
  return path;
}

function validateFlow(flow) {
  const errors = [];
  if (!flow || !flow.nodes || !flow.rootId || !flow.nodes[flow.rootId]) {
    return ['Missing root node.'];
  }
  for (const [id, node] of Object.entries(flow.nodes)) {
    if (node.id !== id) errors.push(`Node key/id mismatch: ${id}`);
    if (!['menu', 'message', 'question', 'chat'].includes(node.action)) {
      errors.push(`Invalid action on ${id}: ${node.action}`);
    }
    for (const childId of node.children || []) {
      const child = flow.nodes[childId];
      if (!child) errors.push(`Missing child ${childId} referenced by ${id}`);
      else if (child.parentId !== id) errors.push(`Bad parent link for ${childId}`);
    }
  }
  return errors;
}

module.exports = {
  newNodeId,
  getNode,
  getChildren,
  createNode,
  deleteSubtree,
  moveSibling,
  getPath,
  validateFlow,
};
