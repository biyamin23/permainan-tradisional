import { useState } from 'react'
import { sfx } from '../../audio/engine'
import { GENDERS, SCREENS, playerActions, usePlayerState } from '../../state/playerState'
import { LandingScenery } from '../landing/LandingScenery'
import { CharacterPreview } from './CharacterPreview'

const MAX_NAME_LENGTH = 16

const CHOICES = [
  { id: GENDERS.LELAKI, emoji: '👦', label: 'LELAKI' },
  { id: GENDERS.PEREMPUAN, emoji: '👧', label: 'PEREMPUAN' },
]

export function CharacterCreation() {
  const savedName = usePlayerState((s) => s.playerName)
  const savedGender = usePlayerState((s) => s.playerGender)
  const [name, setName] = useState(savedName)
  const [gender, setGender] = useState(savedGender)
  const [errors, setErrors] = useState({})
  const [attempted, setAttempted] = useState(false)

  const validate = (nextName, nextGender) => {
    const nextErrors = {}
    if (!nextName.trim()) nextErrors.name = 'Isi nama kamu dulu, ya.'
    if (!nextGender) nextErrors.gender = 'Pilih satu watak.'
    return nextErrors
  }

  const chooseGender = (value) => {
    sfx.tap()
    setGender(value)
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
      return
    }
    sfx.select()
    playerActions.setProfile({ name, gender })
    playerActions.goTo(SCREENS.KAMPUNG)
  }

  const ready = name.trim().length > 0 && Boolean(gender)

  return (
    <section className="character screen-fade-in">
      <LandingScenery dimmed />

      <div className="character__layout">
        <form className="character__card" onSubmit={submit} noValidate>
          <button
            type="button"
            className="text-button character__back"
            onClick={() => {
              sfx.close()
              playerActions.goTo(SCREENS.LANDING)
            }}
          >
            ← Kembali
          </button>

          <label className="character__question" htmlFor="player-name">
            Siapa nama kamu?
          </label>
          <input
            id="player-name"
            className={`field ${errors.name ? 'has-error' : ''}`}
            type="text"
            value={name}
            onChange={onNameChange}
            placeholder="Masukkan nama..."
            maxLength={MAX_NAME_LENGTH}
            autoComplete="off"
            autoFocus
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'name-error' : undefined}
          />
          <p id="name-error" className="field-error" role="alert">
            {errors.name ?? ''}
          </p>

          <p className="character__question character__question--small" id="gender-label">
            Pilih watak kamu
          </p>
          <div className="choice-row" role="radiogroup" aria-labelledby="gender-label">
            {CHOICES.map((choice) => (
              <button
                key={choice.id}
                type="button"
                role="radio"
                aria-checked={gender === choice.id}
                className={`choice ${gender === choice.id ? 'is-selected' : ''}`}
                onClick={() => chooseGender(choice.id)}
              >
                <span className="choice__emoji" aria-hidden="true">
                  {choice.emoji}
                </span>
                <span className="choice__label">{choice.label}</span>
              </button>
            ))}
          </div>
          <p className="field-error" role="alert">
            {errors.gender ?? ''}
          </p>

          <button type="submit" className={`btn btn--primary btn--wide ${ready ? '' : 'is-waiting'}`}>
            <span className="btn__shine" aria-hidden="true" />
            JOM!
          </button>
        </form>

        <div className="character-preview">
          <CharacterPreview gender={gender} onSelect={chooseGender} />
          <p className="character-preview__caption">
            {gender ? (
              <>
                <strong>{name.trim() || 'Kamu'}</strong>, sedia nak balik kampung!
              </>
            ) : (
              'Ketik salah seorang untuk memilih.'
            )}
          </p>
        </div>
      </div>
    </section>
  )
}
