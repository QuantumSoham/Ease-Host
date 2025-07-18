import React, { useState } from 'react';
import './App.css';

function App() {
  const [gitURL, setGitURL] = useState('');
  const [slug, setSlug] = useState('');
  const [responseURL, setResponseURL] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:9000/project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ gitURL, slug }),
      });
      const data = await response.json();
      if (data.status === 'queued') {
        setResponseURL(data.data.url);
      } else {
        setResponseURL('Error: Unable to deploy project.');
      }
    } catch (error) {
      setResponseURL('Error: ' + error.message);
    }
  };

  return (
    <div className="App">
      <h1>EaseHost Deployment</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Enter Git URL"
          value={gitURL}
          onChange={(e) => setGitURL(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Enter Slug (optional)"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
        <button type="submit">Deploy</button>
      </form>
      {responseURL && <p>Response URL: {responseURL}</p>}
    </div>
  );
}

export default App;
