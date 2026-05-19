async function run() {
  const apiKey = 'AIzaSyC-WXXynkztkQMlItseqhGvLh-gJHvZaGg';
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await res.json();
    console.log("Available models:");
    const names = data.models.map(m => m.name);
    console.log(JSON.stringify(names, null, 2));
  } catch (err) {
    console.error(err);
  }
}
run();
