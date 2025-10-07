if (process.env.EXPERIMENTAL === 'true') {
  import('./experimental');
} else {
  import('./stable');
}
