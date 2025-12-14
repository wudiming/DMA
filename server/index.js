const mode = process.env.DMA_MODE;

if (mode === 'agent') {
  console.log('Starting in Agent mode...');
  import('./agent.js').then(m => m.startAgent()).catch(err => {
    console.error('Failed to start agent:', err);
    process.exit(1);
  });
} else {
  console.log('Starting in Manager mode...');
  import('./manager.js').catch(err => {
    console.error('Failed to start manager:', err);
    process.exit(1);
  });
}
