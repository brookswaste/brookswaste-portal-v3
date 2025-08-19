// src/pages/Todo.jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Todo() {
  const navigate = useNavigate()

  // current user + tasks
  const [userEmail, setUserEmail] = useState('')
  const [tasks, setTasks] = useState([])

  // new task form state
  const [showForm, setShowForm] = useState(false)
  const [creatorInput, setCreatorInput] = useState('') // free text
  const [forInput, setForInput] = useState('')         // free text
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')
  // per-task comment drafts
  const [commentDrafts, setCommentDrafts] = useState({})

  // load user + tasks
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/')
        return
      }
      setUserEmail(user.email ?? '')

      // Try to get a human name for the default creator display
      const { data: driver } = await supabase
        .from('drivers')
        .select('name')
        .eq('id', user.id)
        .maybeSingle()

      await fetchTasks()
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchTasks = async () => {
    const { data } = await supabase
      .from('todos')
      .select('*')
      .order('is_complete', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
    setTasks((data || []).map(t => ({
      ...t,
      comments: Array.isArray(t.comments) ? t.comments : []
    })))
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const handleAddTask = async () => {
    if (!description.trim()) {
      alert('Please enter a description.')
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('todos').insert([{
      // keep creator_id for RLS; but display name is free text
      creator_id: user.id,
      creator_name: creatorInput.trim() || userEmail || 'User',
      // free-text assignee; no constraint
      for_user_id: null,
      for_name: forInput.trim() || null,
      due_date: dueDate || null,
      description: description.trim(),
      is_complete: false
    }])

    if (error) {
      console.error(error)
      alert('Failed to add task')
      return
    }

    // reset & refresh (keep creatorInput as-is for convenience)
    setForInput('')
    setDueDate('')
    setDescription('')
    setShowForm(false)
    fetchTasks()
  }

  const toggleComplete = async (task) => {
    const { error } = await supabase
      .from('todos')
      .update({ is_complete: !task.is_complete })
      .eq('id', task.id)

    if (error) {
      console.error(error)
      alert('Failed to update task')
      return
    }
    fetchTasks()
  }

  const deleteTask = async (taskId) => {
    if (!confirm('Delete this task?')) return
    const { error } = await supabase.from('todos').delete().eq('id', taskId)
    if (error) {
      console.error(error)
      alert('Failed to delete task')
      return
    }
    fetchTasks()
  }

  return (
    <div className="bg-wrap bg-gradient-to-br from-white to-slate-100 min-h-screen px-6 py-10 pt-16 relative">
      {/* Log Out (top-right) */}
      <button
        onClick={handleLogout}
        className="btn-bubbly absolute top-4 right-6 text-sm px-4 py-2"
      >
        Log Out
      </button>

      <div className="max-w-5xl mx-auto space-y-8">
        {/* Back nav + header row */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            <button
              onClick={() => navigate('/admin-dashboard')}
              className="hover:underline"
            >
              ← Back to Admin Dashboard
            </button>
          </div>

          <button
            onClick={() => setShowForm(v => !v)}
            className="btn-bubbly text-sm px-4 py-2"
          >
            {showForm ? 'Close' : 'New Task'}
          </button>
        </div>

        {/* Header card */}
        <div className="card-glass">
          <h1 className="text-2xl font-bold text-black">To-Do List</h1>
          <p className="text-sm text-gray-600">
            Create tasks, assign them with free text, mark as complete, or delete when done.
          </p>
        </div>

        {/* New Task form */}
        {showForm && (
          <div className="card-glass">
            <h2 className="text-lg font-semibold text-black mb-3">Create Task</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Creator (free text) */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">Creator</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded"
                  value={creatorInput}
                  onChange={(e) => setCreatorInput(e.target.value)}
                  placeholder="e.g., Cameron"
                />
              </div>

              {/* For Who (free text) */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">For Who?</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded"
                  value={forInput}
                  onChange={(e) => setForInput(e.target.value)}
                  placeholder="e.g., John, Office, Garage"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">Date</label>
                <input
                  type="date"
                  className="w-full p-2 border rounded"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            {/* Description */}
            <div className="mt-4">
              <label className="block text-xs text-gray-600 mb-1">Description</label>
              <textarea
                className="w-full p-2 border rounded min-h-[120px]"
                placeholder="Enter the task details…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="mt-4 flex justify-end">
              <button className="btn-bubbly" onClick={handleAddTask}>
                Add Task
              </button>
            </div>
          </div>
        )}

        {/* Task list */}
        <div className="space-y-4">
          {tasks.length === 0 ? (
            <p className="text-gray-500">No tasks yet.</p>
          ) : (
            tasks.map(task => (
              <div key={task.id} className="card-glass p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className={`text-base ${task.is_complete ? 'line-through text-gray-400' : 'text-black'}`}>
                      {task.description || '—'}
                    </p>
                    <div className="mt-2 text-xs text-gray-600 space-x-4">
                      <span><strong>Creator:</strong> {task.creator_name || '—'}</span>
                      <span><strong>For:</strong> {task.for_name || '—'}</span>
                      <span><strong>Date:</strong> {task.due_date || '—'}</span>
                    </div>
                    {(task.comments || []).length > 0 && (
                      <div className="mt-3 pl-3 border-l border-gray-200">
                        <p className="text-xs font-semibold text-gray-600 mb-1">Comments</p>
                        {task.comments.map((c, idx) => (
                          <div key={idx} className="text-xs text-gray-700 mb-1">
                            <span className="font-medium">{c.by || '—'}</span>{' '}
                            <span className="text-gray-500">• {new Date(c.at).toLocaleString()}</span>
                            <div className="mt-0.5">{c.text}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 pl-3">
                      <input
                        type="text"
                        placeholder="Your name (optional)"
                        className="border rounded px-2 py-1 text-xs w-full mb-1"
                        value={commentDrafts[task.id]?.by || ''}
                        onChange={(e) =>
                          setCommentDrafts(prev => ({
                            ...prev,
                            [task.id]: { ...(prev[task.id] || {}), by: e.target.value }
                          }))
                        }
                      />
                      <textarea
                        placeholder="Write a comment…"
                        className="border rounded px-2 py-1 text-sm w-full"
                        rows={2}
                        value={commentDrafts[task.id]?.text || ''}
                        onChange={(e) =>
                          setCommentDrafts(prev => ({
                            ...prev,
                            [task.id]: { ...(prev[task.id] || {}), text: e.target.value }
                          }))
                        }
                      />
                      <div className="mt-2">
                        <button
                          className="btn-bubbly text-xs"
                          onClick={async () => {
                            const draft = commentDrafts[task.id]
                            if (!draft?.text?.trim()) return

                            const newComment = {
                              by: (draft.by || '').trim() || null,
                              text: draft.text.trim(),
                              at: new Date().toISOString(),
                            }

                            const nextComments = [ ...(task.comments || []), newComment ]

                            const { error } = await supabase
                              .from('todos')
                              .update({ comments: nextComments })
                              .eq('id', task.id)

                            if (!error) {
                              setTasks(prev =>
                                prev.map(t => (t.id === task.id ? { ...t, comments: nextComments } : t))
                              )
                              setCommentDrafts(prev => ({ ...prev, [task.id]: { by: '', text: '' } }))
                            } else {
                              alert('Failed to add comment.')
                              console.error(error)
                            }
                          }}
                        >
                          Add comment
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Mark complete */}
                    <label className="text-sm flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!task.is_complete}
                        onChange={() => toggleComplete(task)}
                      />
                      <span>Complete</span>
                    </label>

                    {/* Delete */}
                    <button
                      className="btn-bubbly text-xs"
                      onClick={() => deleteTask(task.id)}
                      title="Delete task"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
