import mongoose from 'mongoose';
mongoose.connect('mongodb+srv://meenaayushhh141_db_user:8bTLLgbm5LH5zU8r@tracevault.3q0flmf.mongodb.net/TraceVault?appName=tracevault')
  .then(() => { console.log('Connected'); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
