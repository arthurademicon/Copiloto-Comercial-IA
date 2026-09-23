import { useEffect, useState } from 'react'
import {
  BookOpen,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Calendar,
  User,
  ShieldCheck,
  Plus,
  Edit2,
  Trash2,
  Save,
  Loader2,
  Info,
} from 'lucide-react'
import { copilotService } from '@/services/copilotService'
import type { KnowledgeDocument } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export default function Conhecimento() {
  const [docs, setDocs] = useState<KnowledgeDocument[]>([])
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('todas')
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDocument | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Edit / Create Doc Modal
  const [docModalOpen, setDocModalOpen] = useState(false)
  const [editingDocId, setEditingDocId] = useState<string | null>(null)
  const [docTitle, setDocTitle] = useState('')
  const [docCategory, setDocCategory] = useState('Políticas Comerciais')
  const [docVersion, setDocVersion] = useState('v1.0')
  const [docResponsible, setDocResponsible] = useState('Supervisão Comercial')
  const [docStatus, setDocStatus] = useState<'approved' | 'not_approved'>('approved')
  const [docContent, setDocContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadDocs = async () => {
    setIsLoading(true)
    try {
      const res = await copilotService.getKnowledgeDocs()
      setDocs(res)
      if (res.length > 0 && !selectedDoc) {
        setSelectedDoc(res[0])
      } else if (selectedDoc) {
        const fresh = res.find((d) => d.id === selectedDoc.id)
        if (fresh) setSelectedDoc(fresh)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadDocs()
  }, [])

  const categories = Array.from(new Set(docs.map((d) => d.category || 'Geral').filter(Boolean)))

  const filteredDocs = docs.filter((d) => {
    const matchesSearch =
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      (d.content || '').toLowerCase().includes(search.toLowerCase()) ||
      (d.category || '').toLowerCase().includes(search.toLowerCase())

    const matchesCategory =
      selectedCategory === 'todas' || (d.category || 'Geral') === selectedCategory

    return matchesSearch && matchesCategory
  })

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingDocId(null)
    setDocTitle('')
    setDocCategory('Políticas Comerciais')
    setDocVersion('v1.0')
    setDocResponsible('Supervisão Comercial')
    setDocStatus('approved')
    setDocContent('')
    setDocModalOpen(true)
  }

  // Open Edit Modal
  const handleOpenEditModal = (doc: KnowledgeDocument) => {
    setEditingDocId(doc.id)
    setDocTitle(doc.title)
    setDocCategory(doc.category || 'Geral')
    setDocVersion(doc.version || 'v1.0')
    setDocResponsible(doc.responsible || 'Supervisão Comercial')
    setDocStatus(doc.status)
    setDocContent(doc.content || '')
    setDocModalOpen(true)
  }

  // Save Doc (Create or Update)
  const handleSaveDoc = async () => {
    if (!docTitle.trim() || !docContent.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha o título e o conteúdo do documento.',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)
    try {
      if (editingDocId) {
        const updated = await copilotService.updateKnowledgeDoc(editingDocId, {
          title: docTitle,
          category: docCategory,
          version: docVersion,
          responsible: docResponsible,
          status: docStatus,
          content: docContent,
        })
        setSelectedDoc(updated)
        toast({ title: 'Documento atualizado com sucesso!' })
      } else {
        const created = await copilotService.createKnowledgeDoc({
          title: docTitle,
          category: docCategory,
          version: docVersion,
          responsible: docResponsible,
          status: docStatus,
          content: docContent,
        })
        setSelectedDoc(created)
        toast({ title: 'Documento homologado na base de conhecimento!' })
      }
      setDocModalOpen(false)
      loadDocs()
    } catch {
      toast({ title: 'Erro ao salvar documento', variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteDoc = async (id: string) => {
    if (!confirm('Deseja realmente remover este documento da base de conhecimento?')) return
    try {
      await copilotService.deleteKnowledgeDoc(id)
      toast({ title: 'Documento removido da base de conhecimento.' })
      if (selectedDoc?.id === id) {
        setSelectedDoc(null)
      }
      loadDocs()
    } catch {
      toast({ title: 'Erro ao remover documento', variant: 'destructive' })
    }
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827] flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[#4F46E5]" />
            Base de Conhecimento Oficial
          </h1>
          <p className="text-xs text-[#6B7280] mt-1">
            Gestão das regras, manuais e scripts homologados que orientam o motor RAG do Copiloto
            IA.
          </p>
        </div>

        <Button
          onClick={handleOpenCreateModal}
          className="h-9 px-4 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Adicionar Documento
        </Button>
      </div>

      {/* Regra de Ouro da IA */}
      <div className="bg-[#EEF2FF]/60 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#4F46E5] mt-0.5 flex-shrink-0" />
        <div className="text-xs text-[#374151] leading-relaxed">
          <strong className="text-[#111827]">Princípio de Proteção Institucional:</strong> A
          inteligência artificial só prioriza e cita documentos com status{' '}
          <strong>"Aprovado"</strong>. Quando não houver fundamento suficiente na base homologada, a
          resposta padrão do Copiloto é:{' '}
          <span className="italic text-[#4F46E5] font-semibold">
            "Não encontrei informação confiável suficiente para responder. Recomendo validação
            técnica."
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left List of Documents (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-5 border border-[#E5E7EB] space-y-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-2.5" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por título, regra ou categoria..."
                className="pl-9 text-xs h-9 rounded-xl bg-[#F9FAFB]"
              />
            </div>

            {/* Category pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              <button
                onClick={() => setSelectedCategory('todas')}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-medium transition whitespace-nowrap',
                  selectedCategory === 'todas'
                    ? 'bg-[#4F46E5] text-white'
                    : 'bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]',
                )}
              >
                Todas
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-[11px] font-medium transition whitespace-nowrap',
                    selectedCategory === cat
                      ? 'bg-[#4F46E5] text-white'
                      : 'bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]',
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
            {filteredDocs.map((doc) => {
              const isSelected = selectedDoc?.id === doc.id
              const isApproved = doc.status === 'approved'

              return (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDoc(doc)}
                  className={cn(
                    'p-3.5 rounded-2xl border cursor-pointer transition-all space-y-2 text-xs',
                    isSelected
                      ? 'border-[#4F46E5] bg-[#EEF2FF]/50 shadow-xs'
                      : 'border-[#E5E7EB] hover:bg-slate-50',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-[#4F46E5] uppercase tracking-wider">
                      {doc.category || 'Geral'}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[9px] px-1.5 py-0 capitalize border',
                        isApproved
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200',
                      )}
                    >
                      {isApproved ? 'Aprovado' : 'Não aprovado'}
                    </Badge>
                  </div>

                  <h3 className="font-semibold text-[#111827] leading-snug line-clamp-2">
                    {doc.title}
                  </h3>

                  <div className="flex items-center justify-between text-[10px] text-[#9CA3AF] pt-1 border-t border-[#F3F4F6]">
                    <span>Versão: {doc.version || 'v1.0'}</span>
                    <span>
                      {doc.published_at
                        ? new Date(doc.published_at).toLocaleDateString('pt-BR')
                        : ''}
                    </span>
                  </div>
                </div>
              )
            })}

            {filteredDocs.length === 0 && (
              <div className="text-center py-12 text-xs text-[#9CA3AF]">
                Nenhum documento encontrado para os filtros aplicados.
              </div>
            )}
          </div>
        </div>

        {/* Right Preview & Actions (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)] min-h-[640px] flex flex-col justify-between">
          {selectedDoc ? (
            <div className="space-y-4">
              <div className="pb-4 border-b border-[#E5E7EB] flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs text-[#4F46E5] bg-[#EEF2FF]">
                      {selectedDoc.category}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs border',
                        selectedDoc.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200',
                      )}
                    >
                      {selectedDoc.status === 'approved' ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 mr-1 inline" />
                          Documento Oficial Aprovado
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 mr-1 inline" />
                          Não Aprovado (Ignorado pela IA)
                        </>
                      )}
                    </Badge>
                  </div>

                  <h2 className="text-lg font-bold text-[#111827]">{selectedDoc.title}</h2>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-[#6B7280] pt-1">
                    <span>
                      Versão: <strong className="text-[#111827]">{selectedDoc.version}</strong>
                    </span>
                    <span>
                      Responsável:{' '}
                      <strong className="text-[#111827]">
                        {selectedDoc.responsible || 'Supervisão Comercial'}
                      </strong>
                    </span>
                    <span>
                      Publicado:{' '}
                      <strong className="text-[#111827]">
                        {selectedDoc.published_at
                          ? new Date(selectedDoc.published_at).toLocaleDateString('pt-BR')
                          : 'Sem data'}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenEditModal(selectedDoc)}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Edit2 className="w-3 h-3" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteDoc(selectedDoc.id)}
                    className="h-8 text-xs text-[#EF4444] hover:bg-rose-50 p-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Document Text Content */}
              <div className="p-4 bg-[#F9FAFB] rounded-2xl border border-[#E5E7EB] text-xs text-[#374151] leading-relaxed whitespace-pre-wrap font-sans max-h-[440px] overflow-y-auto">
                {selectedDoc.content || 'Nenhum conteúdo registrado neste documento.'}
              </div>
            </div>
          ) : (
            <div className="text-center py-24 text-xs text-[#9CA3AF]">
              Selecione um documento na coluna à esquerda para visualizar suas diretrizes e regras.
            </div>
          )}

          <div className="pt-4 border-t border-[#E5E7EB] flex items-center justify-between text-xs text-[#6B7280]">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#10B981]" />
              Indexado para consultas semânticas do Copiloto no WhatsApp.
            </span>
          </div>
        </div>
      </div>

      {/* Dialog: Create or Edit Knowledge Doc */}
      <Dialog open={docModalOpen} onOpenChange={setDocModalOpen}>
        <DialogContent className="max-w-2xl rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#111827]">
              {editingDocId ? 'Editar Documento da Base' : 'Novo Documento de Conhecimento'}
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 space-y-3.5 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-[#374151]">Título do documento:</label>
              <Input
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="Ex: Política Oficial de Lance Embutido e FGTS"
                className="text-xs h-9 rounded-xl bg-[#F9FAFB]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-[#374151]">Categoria:</label>
                <Input
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value)}
                  placeholder="Ex: Políticas Comerciais"
                  className="text-xs h-9 rounded-xl bg-[#F9FAFB]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#374151]">Versão:</label>
                <Input
                  value={docVersion}
                  onChange={(e) => setDocVersion(e.target.value)}
                  placeholder="Ex: v1.2"
                  className="text-xs h-9 rounded-xl bg-[#F9FAFB]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#374151]">Status de Homologação:</label>
                <select
                  value={docStatus}
                  onChange={(e) => setDocStatus(e.target.value as 'approved' | 'not_approved')}
                  className="w-full text-xs h-9 border border-[#E5E7EB] rounded-xl px-2.5 bg-[#F9FAFB]"
                >
                  <option value="approved">Aprovado (Usado pela IA)</option>
                  <option value="not_approved">Não aprovado (Em revisão)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-[#374151]">Responsável / Homologador:</label>
              <Input
                value={docResponsible}
                onChange={(e) => setDocResponsible(e.target.value)}
                placeholder="Ex: Diretoria Comercial"
                className="text-xs h-9 rounded-xl bg-[#F9FAFB]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-[#374151]">
                Conteúdo textual (alimenta o RAG da IA):
              </label>
              <textarea
                value={docContent}
                onChange={(e) => setDocContent(e.target.value)}
                placeholder="Insira as regras, faixas de valores, prazos e respostas permitidas..."
                rows={9}
                className="w-full text-xs p-3 border border-[#E5E7EB] rounded-xl bg-[#F9FAFB] focus:ring-1 focus:ring-indigo-500 font-sans leading-relaxed"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="ghost"
              onClick={() => setDocModalOpen(false)}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveDoc}
              disabled={isSubmitting}
              className="h-9 px-4 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold gap-1.5"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {editingDocId ? 'Atualizar Documento' : 'Salvar na Base'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
