var raytraceFS = `
struct Ray {
	vec3 pos;
	vec3 dir;
};

struct Material {
	vec3  k_d;	// diffuse coefficient
	vec3  k_s;	// specular coefficient
	float n;	// specular exponent
};

struct Sphere {
	vec3     center;
	float    radius;
	Material mtl;
};

struct Light {
	vec3 position;
	vec3 intensity;
};

struct HitInfo {
	float    t;
	vec3     position;
	vec3     normal;
	Material mtl;
};

uniform Sphere spheres[ NUM_SPHERES ];
uniform Light  lights [ NUM_LIGHTS  ];
uniform samplerCube envMap;
uniform int bounceLimit;

bool IntersectRay( inout HitInfo hit, Ray ray );

// Shades the given point and returns the computed color.
vec3 Shade( Material mtl, vec3 position, vec3 normal, vec3 view )
{
	vec3 color = vec3(0,0,0);
	for ( int i=0; i < NUM_LIGHTS; ++i ) {
		//Check for shadows
		Ray ray; 
		HitInfo hit;
		ray.dir = normalize(lights[i].position - position);
		ray.pos = position;
		
		bool intersect = IntersectRay(hit,ray);

		if(intersect){
            continue;
		}

		//If not shadowed, perform shading using the Blinn model
		vec3 dir = normalize((lights[i].position - position));
		float cosTheta = dot(normal, dir);
		vec3 diffuse = mtl.k_d * lights[i].intensity * max(0.0, cosTheta); 
		vec3 halfDir = normalize(view + dir);
		vec3 specular = mtl.k_s * lights[i].intensity * pow(max(0.0, dot(normal, halfDir)),mtl.n); 
		
		color += diffuse + specular;	// change this line	
	}
	return color;
}

// Intersects the given ray with all spheres in the scene
// and updates the given HitInfo using the information of the sphere
// that first intersects with the ray.
// Returns true if an intersection is found.
bool IntersectRay( inout HitInfo hit, Ray ray )
{
	hit.t = 1e30;
	bool foundHit = false;
	for ( int i=0; i<NUM_SPHERES; ++i ) {
		//Test for ray-sphere intersection
		vec3 position = ray.pos - spheres[i].center ;
		float a = dot(ray.dir,ray.dir);
		float b =  dot((2.0 * position),ray.dir);
		float c = dot(position,position) - pow(spheres[i].radius, 2.0);
		float delta = (b*b)-(4.0*a*c);
		
		//If intersection is found, update the given HitInfo
		if(delta>=0.0){
			float t0 = (-b-sqrt(delta))/(2.0 * a);

			if(t0 > 0.0 && t0 <= hit.t){
				foundHit = true;
				hit.t = t0;
				hit.position = ray.pos + (t0 * ray.dir);
				hit.normal = normalize(hit.position - spheres[i].center);
				hit.mtl = spheres[i].mtl;
			}
        }
	}
	return foundHit;
}

// Given a ray, returns the shaded color where the ray intersects a sphere.
// If the ray does not hit a sphere, returns the environment color.
vec4 RayTracer( Ray ray )
{
	HitInfo hit;
	if ( IntersectRay( hit, ray ) ) {
		vec3 view = normalize( -ray.dir );
		vec3 clr = Shade( hit.mtl, hit.position, hit.normal, view );
		
		// Compute reflections
		vec3 k_s = hit.mtl.k_s;
		for ( int bounce=0; bounce<MAX_BOUNCES; ++bounce ) {
			if ( bounce >= bounceLimit ) break;
			if ( hit.mtl.k_s.r + hit.mtl.k_s.g + hit.mtl.k_s.b <= 0.0 ) break;
			
			Ray r;	// this is the reflection ray
			HitInfo h;	// reflection hit info
			
			//Initialize the reflection ray
			//r.dir = normalize(ray.dir) - 2.0 * (dot(normalize(ray.dir), hit.normal))* hit.normal;
			r.dir = normalize(reflect(ray.dir, hit.normal));
			r.pos = hit.position;

			if ( IntersectRay( h, r ) ) {
				//Hit found, so shade the hit point
				clr += k_s * Shade(h.mtl, h.position, h.normal, view); //problem?

				//Update the loop variables for tracing the next reflection ray
				ray = r;
				k_s = k_s * h.mtl.k_s;
				hit = h;
				

			} else {
				// The refleciton ray did not intersect with anything,
				// so we are using the environment color
				clr += k_s * textureCube( envMap, r.dir.xzy ).rgb;
				break;	// no more reflections
			}
		}
		return vec4( clr, 1 );	// return the accumulated color, including the reflections
	} else {
		return vec4( textureCube( envMap, ray.dir.xzy ).rgb, 1 );	// return the environment color
	}
}
`;