import {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  type KeyboardEvent,
  type FocusEvent,
} from 'react'
import { cn } from '../../lib/utils'

export interface EditableTextareaProps {
  /** Current value */
  value: string
  /** Called when value changes and should be saved (on blur or Ctrl+Enter) */
  onSave: (value: string) => void
  /** Placeholder text when empty */
  placeholder?: string
  /** Whether the input should auto-focus on mount */
  autoFocus?: boolean
  /** Called when editing starts (focus) */
  onEditStart?: () => void
  /** Called when editing ends (blur or save) */
  onEditEnd?: () => void
  /** Called when user presses Escape */
  onCancel?: () => void
  /** Additional class names for the container */
  className?: string
  /** Additional class names for the text display (when not focused) */
  textClassName?: string
  /** Additional class names for the textarea */
  textareaClassName?: string
  /** Whether the field is disabled */
  disabled?: boolean
  /** Minimum number of rows */
  minRows?: number
  /** Text to show when empty */
  emptyText?: string
  /** aria-label for accessibility */
  'aria-label'?: string
}

/**
 * Editable textarea that is ALWAYS a textarea element (never switches to div).
 * Looks like text when not focused, shows textarea styling when focused.
 * Saves only on blur or Ctrl+Enter - no debounced saves while typing.
 * This prevents focus loss during re-renders since the DOM element never changes.
 */
export const EditableTextarea = forwardRef<HTMLTextAreaElement, EditableTextareaProps>(
  function EditableTextarea(
    {
      value,
      onSave,
      placeholder = 'Click to add description...',
      autoFocus = false,
      onEditStart,
      onEditEnd,
      onCancel,
      className,
      textClassName,
      textareaClassName,
      disabled = false,
      minRows = 4,
      'aria-label': ariaLabel,
    },
    forwardedRef
  ) {
    const [isFocused, setIsFocused] = useState(false)
    const [localValue, setLocalValue] = useState(value)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const lastSavedRef = useRef(value)
    const isFocusedRef = useRef(false)
    
    // Keep ref in sync with state for use in effects
    useEffect(() => {
      isFocusedRef.current = isFocused
    }, [isFocused])
    
    // Sync local value when prop changes (from server response)
    // Only runs when VALUE changes, not when focus changes
    // This prevents reverting to old value on blur before mutation completes
    useEffect(() => {
      // Don't sync if user is currently editing
      if (isFocusedRef.current) return
      
      // Only sync if the server sent back something different than what we saved
      // This handles: server normalization, concurrent updates, error rollbacks
      if (value !== lastSavedRef.current) {
        setLocalValue(value)
        lastSavedRef.current = value
      }
    }, [value]) // Only depend on value prop changes
    
    // Auto-resize textarea to fit content
    useEffect(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
      }
    }, [localValue])
    
    // Handle save - only called on blur or Ctrl+Enter
    const handleSave = useCallback((newValue: string) => {
      // Don't save if value hasn't changed
      if (newValue === lastSavedRef.current) return
      
      lastSavedRef.current = newValue
      onSave(newValue)
    }, [onSave])
    
    // Handle textarea change - just update local state, no save
    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setLocalValue(e.target.value)
    }, [])
    
    // Handle focus
    const handleFocus = useCallback(() => {
      setIsFocused(true)
      onEditStart?.()
    }, [onEditStart])
    
    // Handle blur - save on blur
    const handleBlur = useCallback((e: FocusEvent<HTMLTextAreaElement>) => {
      // Check if focus is moving to another element within our component
      const relatedTarget = e.relatedTarget as HTMLElement | null
      if (relatedTarget?.closest('[data-editable-container]')) {
        return
      }
      
      setIsFocused(false)
      handleSave(localValue)
      onEditEnd?.()
    }, [handleSave, localValue, onEditEnd])
    
    // Handle key press
    const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Ctrl/Cmd + Enter to save and blur
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSave(localValue)
        textareaRef.current?.blur()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        // Restore original value and blur
        setLocalValue(lastSavedRef.current)
        textareaRef.current?.blur()
        onCancel?.()
      }
    }, [handleSave, localValue, onCancel])
    
    // Combine refs
    const setRefs = useCallback((node: HTMLTextAreaElement | null) => {
      textareaRef.current = node
      if (typeof forwardedRef === 'function') {
        forwardedRef(node)
      } else if (forwardedRef) {
        forwardedRef.current = node
      }
    }, [forwardedRef])
    
    const isEmpty = !localValue.trim()
    
    return (
      <div
        className={cn('relative', className)}
        data-editable-container
      >
        <textarea
          ref={setRefs}
          value={localValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          rows={minRows}
          className={cn(
            // Base styles - always a textarea but looks like text when not focused
            'w-full bg-transparent border-0 outline-none resize-none',
            'rounded px-1 -ml-1 py-1',
            'transition-colors',
            // Unfocused: looks like plain text
            !isFocused && [
              'hover:bg-accent/50',
              isEmpty && 'text-muted-foreground italic',
              textClassName,
            ],
            // Focused: shows textarea styling
            isFocused && [
              'bg-background ring-2 ring-ring ring-offset-2 ring-offset-background',
              'not-italic',
              textareaClassName,
            ],
            // Disabled state
            disabled && 'cursor-default opacity-50 hover:bg-transparent',
          )}
          aria-label={ariaLabel}
        />
      </div>
    )
  }
)
