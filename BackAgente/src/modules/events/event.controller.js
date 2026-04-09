export function streamEventsController(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = () => {
    const payload = {
      id: Date.now(),
      type: 'heartbeat',
      message: `Evento emitido ${new Date().toLocaleTimeString()}`
    };

    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  sendEvent();
  const interval = setInterval(sendEvent, 5000);

  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
}
