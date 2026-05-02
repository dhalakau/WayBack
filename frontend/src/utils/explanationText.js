export function getExplanationText(item, explanation) {
  const { reason, distanceMeters, monthsSinceSaved } = explanation
  const { viewCount } = item
  
    if (reason === 'nearby_and_recent_save') {
    return `${distanceMeters}m away · saved ${monthsSinceSaved} months ago`
  }

    if(reason === 'nearby_frequent_view') {
    return `${distanceMeters}m away · viewed ${viewCount} times`
    }
    if(reason ==='nearby_unvisited'){
    return `${distanceMeters}m away · haven't visited yet`
    }

    if (reason === 'matches_weather_indoor') {
    return `Indoor spot · good for rainy weather`
  }

  if (reason === 'saved_long_ago') {
    const km = (distanceMeters / 1000).toFixed(1)
    return `${km}km away · saved ${monthsSinceSaved} months ago, time to revisit?`
  }
  
  // TODO: handle other reasons
  
  return 'Recommended for you'  // fallback
}
