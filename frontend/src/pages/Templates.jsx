import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react'
import { Card } from '../components/ui/card'
import { api } from '../services/api'

function Templates() {
    const [templates, setTemplates] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [currentTemplate, setCurrentTemplate] = useState(null)
    const [formData, setFormData] = useState({ name: '', content: '' })
    const [error, setError] = useState('')

    useEffect(() => {
        fetchTemplates()
    }, [])

    const fetchTemplates = async () => {
        try {
            const res = await api.get('/templates')
            setTemplates(res.data)
        } catch (err) {
            console.error('Failed to fetch templates', err)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this template?')) return

        try {
            await api.delete(`/templates/${id}`)
            fetchTemplates()
        } catch (err) {
            console.error('Failed to delete template', err)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        try {
            if (currentTemplate) {
                await api.put(`/templates/${currentTemplate.id}`, formData)
            } else {
                await api.post('/templates', formData)
            }

            setShowModal(false)
            setFormData({ name: '', content: '' })
            setCurrentTemplate(null)
            fetchTemplates()
        } catch (err) {
            setError(err.response?.data?.error || err.message)
        }
    }

    const openModal = (template = null) => {
        if (template) {
            setCurrentTemplate(template)
            setFormData({ name: template.name, content: template.content })
        } else {
            setCurrentTemplate(null)
            setFormData({ name: '', content: '' })
        }
        setShowModal(true)
    }

    if (loading) return <div className="p-8">Loading...</div>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Message Templates</h1>
                    <p className="text-gray-500">Manage your quick response templates</p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-whatsapp-500 text-white rounded-lg hover:bg-whatsapp-600 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Add Template
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.map((template) => (
                    <Card key={template.id} className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="font-semibold text-lg text-gray-900">{template.name}</h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => openModal(template)}
                                    className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(template.id)}
                                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-md text-sm text-gray-600 whitespace-pre-wrap">
                            {template.content}
                        </div>
                    </Card>
                ))}
                {templates.length === 0 && (
                    <div className="col-span-full text-center py-12 text-gray-500">
                        No templates found. Create one to get started.
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-md w-full p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-semibold">
                                {currentTemplate ? 'Edit Template' : 'New Template'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Template Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-whatsapp-500 focus:border-transparent"
                                    placeholder="e.g., Welcome Message"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Content
                                </label>
                                <textarea
                                    required
                                    rows={5}
                                    value={formData.content}
                                    onChange={e => setFormData({ ...formData, content: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-whatsapp-500 focus:border-transparent"
                                    placeholder="Hello, thank you for contacting us..."
                                />
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-whatsapp-500 text-white rounded-lg hover:bg-whatsapp-600 flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    Save Template
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Templates
