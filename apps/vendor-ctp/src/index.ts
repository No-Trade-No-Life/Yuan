import './ctp-service';
if (!process.env.RUN_CTP_ONLY) {
  import('./exchange');
}
