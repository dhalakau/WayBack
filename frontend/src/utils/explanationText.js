

export function getFullDate(savedAt) {
  if (!savedAt) return ''
  return new Date(savedAt).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}


function formatDistance(meters) {
  if (!meters) return ''
  if (meters < 1000) return `${meters}m away`
  return `${(meters / 1000).toFixed(1)}km away`
}

function formatTimeAgo(savedAt) {
  if (!savedAt) return 'recently'
  const days = Math.floor((Date.now() - savedAt) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'just now'
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks} week${weeks > 1 ? 's' : ''} ago`
  const months = Math.floor(days / 30)
  return `${months} month${months > 1 ? 's' : ''} ago`
}

export function getExplanationText(item, explanation) {
  const { reason, distanceMeters } = explanation
  const { viewCount, savedAt } = item
  const dist = formatDistance(distanceMeters)
  const timeAgo = formatTimeAgo(savedAt)

  if (reason === 'nearby_and_recent_save') return `${dist} · saved ${timeAgo}`
  if (reason === 'nearby_frequent_view') return `${dist} · viewed ${viewCount} times · saved ${timeAgo}`
  if (reason === 'nearby_unvisited') return `${dist} · haven't visited yet · saved ${timeAgo}`
  if (reason === 'matches_weather_indoor') return `Indoor spot · good for rainy weather · saved ${timeAgo}`
  if (reason === 'saved_long_ago') return `${dist} · saved ${timeAgo}, time to revisit?`
  return `Recommended for you · saved ${timeAgo}`
}