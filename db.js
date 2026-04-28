const mongoose = require('mongoose');

let isConnected = false;

async function connect(uri) {
  if (isConnected) return;
  await mongoose.connect(uri);
  isConnected = true;
  console.log('✅ MongoDB connected');
}

function getConnection() {
  return mongoose.connection;
}

module.exports = { connect, getConnection };
