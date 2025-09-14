import { useCallback, useState, useEffect } from 'react'
import PropTypes from 'prop-types'

/**
 * Placeholder modal for creating a GitHub repository.
 * This component is NOT wired to any API or global state; it is a scaffold only.
 *
 * Accessibility:
 * - Uses role="dialog", aria-modal, and aria-labelledby for screen readers.
 *
 * Behavior:
 * - When isOpen is false, renders null (no DOM impact).
 * - "Create" triggers onCreate?.({ owner, repo, description, visibility }) then onClose?.()
 * - "Cancel" triggers onClose?.()
 *
 * @param {Object} props - Component props
 * @param {boolean} [props.isOpen=false] - Controls visibility of the modal; when false, returns null.
 * @param {Function} props.onClose - Required callback when user cancels/closes.
 * @param {Function} [props.onCreate] - Optional callback when user submits "Create".
 * @param {string} [props.initialOwner] - Initial owner value.
 * @param {string} [props.initialRepo] - Initial repository name.
 * @param {string} [props.initialDescription] - Initial description.
 * @param {'public'|'private'} [props.initialVisibility='private'] - Initial repository visibility.
 * @returns {JSX.Element|null}
 */
function GitHubRepositoryModal({
  isOpen = false,
  onClose,
  onCreate,
  initialOwner = '',
  initialRepo = '',
  initialDescription = '',
  initialVisibility = 'private'
}) {
  const [owner, setOwner] = useState(initialOwner)
  const [repo, setRepo] = useState(initialRepo)
  const [description, setDescription] = useState(initialDescription)
  const [visibility, setVisibility] = useState(initialVisibility)

  // Reset internal state when modal is opened or initial values change
  useEffect(() => {
    if (isOpen) {
      setOwner(initialOwner || '')
      setRepo(initialRepo || '')
      setDescription(initialDescription || '')
      setVisibility(initialVisibility || 'private')
    }
  }, [isOpen, initialOwner, initialRepo, initialDescription, initialVisibility])

  const handleCancel = useCallback(() => {
    onClose?.()
  }, [onClose])

  const handleCreate = useCallback(() => {
    onCreate?.({ owner, repo, description, visibility })
    onClose?.()
  }, [onCreate, onClose, owner, repo, description, visibility])

  if (!isOpen) return null

  const titleId = 'github-repo-modal-title'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" onClick={handleCancel}></div>

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-lg rounded-lg bg-white p-6 shadow-lg"
      >
        <h2 id={titleId} className="mb-4 text-lg font-semibold text-gray-900">
          Create GitHub Repository (Placeholder)
        </h2>

        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div>
            <label htmlFor="gh-owner" className="mb-1 block text-sm font-medium text-gray-700">
              Owner
            </label>
            <input
              id="gh-owner"
              type="text"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="e.g., claritybusinesssolutions"
            />
          </div>

          <div>
            <label htmlFor="gh-repo" className="mb-1 block text-sm font-medium text-gray-700">
              Repository Name
            </label>
            <input
              id="gh-repo"
              type="text"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="e.g., clarity-admin-frontend"
            />
          </div>

          <div>
            <label htmlFor="gh-description" className="mb-1 block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="gh-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[72px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Brief repository description"
            />
          </div>

          <div>
            <label htmlFor="gh-visibility" className="mb-1 block text-sm font-medium text-gray-700">
              Visibility
            </label>
            <select
              id="gh-visibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="private">Private</option>
              <option value="public">Public</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

GitHubRepositoryModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onCreate: PropTypes.func,
  initialOwner: PropTypes.string,
  initialRepo: PropTypes.string,
  initialDescription: PropTypes.string,
  initialVisibility: PropTypes.oneOf(['public', 'private'])
}

export default GitHubRepositoryModal