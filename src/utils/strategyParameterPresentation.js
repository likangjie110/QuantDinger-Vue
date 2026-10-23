function translatedValue (translate, key) {
  if (!key || typeof translate !== 'function') return ''
  const value = translate(key)
  return value === key ? '' : value
}

export function strategyParameterLabel (param = {}, translate) {
  return translatedValue(translate, param.labelKey || param.label_key) ||
    translatedValue(translate, `strategyBuilder.params.${param.name}.label`) ||
    translatedValue(translate, `trading-assistant.templateParam.${param.name}.label`) ||
    param.label ||
    String(param.name || '').replace(/_/g, ' ')
}

export function strategyParameterDescription (param = {}, translate, locale = '') {
  const localized = translatedValue(translate, param.descriptionKey || param.description_key) ||
    translatedValue(translate, `strategyBuilder.params.${param.name}.description`) ||
    translatedValue(translate, `trading-assistant.templateParam.${param.name}.desc`)
  if (localized) return localized
  return String(locale || '').toLowerCase().startsWith('en') ? (param.description || '') : ''
}

/**
 * @typedef {Object} StrategyParameterOption
 * @property {string|number} [value]
 * @property {string} [labelKey]
 * @property {string} [label_key]
 * @property {string} [label]
 */

export function strategyParameterOptionLabel (param = {}, option = {}, translate) {
  const optionObject = option && typeof option === 'object' ? /** @type {StrategyParameterOption} */ (option) : null
  const value = optionObject ? optionObject.value : option
  const labelKey = optionObject ? (optionObject.labelKey || optionObject.label_key) : ''
  return translatedValue(translate, labelKey) ||
    translatedValue(translate, `strategyBuilder.params.${param.name}.options.${value}`) ||
    (optionObject ? (optionObject.label || value) : value)
}

export function strategyParameterOptions (param = {}) {
  if (Array.isArray(param.options)) {
    return param.options.map(option => (
      option && typeof option === 'object' ? option : { value: option, label: option }
    ))
  }
  if (Array.isArray(param.values)) {
    return param.values.map(value => ({ value, label: value }))
  }
  return []
}
