module.exports = {
  resolve: {
    alias: {
      'fs': 'filesystem', // see src/app/filesystem
    }
  },
  node: {
    process: true,
    path: true,
    buffer: true,
    Buffer: true,
  }
};
