const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0"; // important

app.listen(PORT, HOST, () => {
  console.log(`Local:   http://localhost:${PORT}`);
  console.log(`Network: http://192.168.50.219:${PORT}`);
});