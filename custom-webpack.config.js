module.exports = {
  resolve: {
    alias: {
      'fs': 'filesystem',
    }
  },
  node: {
    process: true,
    path: true,
    buffer: true,
    Buffer: true,
  }
};
