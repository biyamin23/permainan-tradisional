import { useRef, useState } from 'react'
import { sfx } from '../../audio/engine'
import { GENDERS, SCREENS, playerActions, usePlayerState } from '../../state/playerState'
import { LandingScenery } from '../landing/LandingScenery'
import './character.css'

const MAX_NAME_LENGTH = 16

// the same faces the player sees later on the game screens
const CHOICES = [
  { id: GENDERS.LELAKI, img: '/avatars/pemain-lelaki.webp', label: 'LELAKI' },
  { id: GENDERS.PEREMPUAN, img: '/avatars/pemain-perempuan.webp', label: 'PEREMPUAN' },
]

/** Name and character: one card, big picture tiles, a big JOM! button. */
export function CharacterCreation() {
  const savedName = usePlayerState((s) => s.playerName)
  const savedGender = usePlayerState((s) => s.playerGender)
  const [name, setName] = useState(savedName)
  const [gender, setGender] = useState(savedGender)
  const [errors, setErrors] = useState({})
  const [attempted, setAttempted] = useState(false)
  const input = useRef(null)

  const validate = (nextName, nextGender) => {
    const nextErrors = {}
    if (!nextName.trim()) nextErrors.name = 'Isi nama kamu dulu, ya.'
    if (!nextGender) nextErrors.gender = 'Pilih satu watak.'
    return nextErrors
  }

  const chooseGender = (value) => {
    sfx.tap()
    setGender(value)
    input.current?.blur()
    if (attempted) setErrors(validate(name, value))
  }

  const onNameChange = (event) => {
    const value = event.target.value.slice(0, MAX_NAME_LENGTH)
    setName(value)
    if (attempted) setErrors(validate(value, gender))
  }

  const submit = (event) => {
    event.preventDefault()
    setAttempted(true)
    const nextErrors = validate(name, gender)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      sfx.locked()
      if (nextErrors.name) input.current?.focus()
      return
    }
    sfx.select()
    playerActions.setProfile({ name: name.trim(), gender })
    playerActions.goTo(SCREENS.KAMPUNG)
  }

  // "Done" on the phone keyboard just closes it, so the characters are in view
  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !gender) {
      event.preventDefault()
      event.currentTarget.blur()
    }
  }

  const ready = name.trim().length > 0 && Boolean(gender)

  return (
    <section className="character screen-fade-in">
      <LandingScenery dimmed />

      <form className="cc-card" onSubmit={submit} noValidate autoComplete="off">
        <button
          type="button"
          className="cc-back"
          onClick={() => {
            sfx.close()
            playerActions.goTo(SCREENS.LANDING)
          }}
        >
          <span aria-hidden="true">←</span> Kembali
        </button>

        <label className="cc-title" htmlFor="watak-panggilan">
          Siapa nama kamu?
        </label>
        <div className={`cc-field ${errors.name ? 'has-error' : ''}`}>
          <span className="cc-field__icon" aria-hidden="true">
            ✏️
          </span>
          {/* not called "name" anywhere, so phones don't offer to fill in a contact */}
          <input
            ref={input}
            id="watak-panggilan"
            name="panggilan"
            type="text"
            value={name}
            onChange={onNameChange}
            onKeyDown={onKeyDown}
            placeholder="Masukkan nama..."
            maxLength={MAX_NAME_LENGTH}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="words"
            spellCheck={false}
            enterKeyHint="done"
            data-lpignore="true"
            data-form-type="other"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'name-error' : undefined}
          />
        </div>
        <p id="name-error" className="cc-error" role="alert">
          {errors.name ?? ''}
        </p>

        <p className="cc-tag" id="gender-label">
          Pilih watak kamu
        </p>
        <div className={`cc-choices ${gender ? 'has-choice' : ''}`} role="radiogroup" aria-labelledby="gender-label">
          {CHOICES.map((choice) => (
            <button
              key={choice.id}
              type="button"
              role="radio"
              aria-checked={gender === choice.id}
              className={`cc-choice cc-choice--${choice.id} ${gender === choice.id ? 'is-selected' : ''}`}
              onClick={() => chooseGender(choice.id)}
            >
              <span className="cc-choice__pic">
                <img src={choice.img} alt="" width="192" height="192" decoding="async" />
              </span>
              <span className="cc-choice__label">{choice.label}</span>
              <span className="cc-choice__tick" aria-hidden="true">
                ✓
              </span>
            </button>
          ))}
        </div>
        <p className="cc-error" role="alert">
          {errors.gender ?? ''}
        </p>

        <button type="submit" className={`cc-go ${ready ? 'is-ready' : ''}`}>
          JOM!
        </button>
      </form>
    </section>
  )
}
