import math



def geo_radius_to_box(lat : float, long : float, radius : float):
    lat_range = radius / 69
    long_range = radius / (69.17 * math.cos(lat))
    min_lat = lat - lat_range
    max_lat = lat + lat_range
    min_long = long - long_range
    max_long = long + long_range

    return (min_lat, min_long), (max_lat, max_long)
