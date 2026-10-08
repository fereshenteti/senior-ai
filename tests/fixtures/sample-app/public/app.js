const list = document.querySelector('#notes');
const form = document.querySelector('#note-form');

async function load() {
  const notes = await (await fetch('/api/notes')).json();
  list.replaceChildren(...notes.map(note => Object.assign(document.createElement('li'), { textContent: note.title })));
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const title = form.title.value;
  await fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });
  form.reset();
  load();
});

load();
