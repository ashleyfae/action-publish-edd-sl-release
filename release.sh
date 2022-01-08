# Ensure that the WORDPRESS_USER secret is included
if [[ -z "$WORDPRESS_USER" ]]; then
  echo "Set the WORDPRESS_USER env variable."
  exit 1
fi

# Ensure that the WORDPRESS_PASS secret is included
if [[ -z "$WORDPRESS_PASS" ]]; then
  echo "Set the WORDPRESS_PASS env variable."
  exit 1
fi

RELEASE_URL=$( jq '.url' ${RELEASE_CONFIG} )
RELEASE_VERSION=$( jq '.version' ${RELEASE_CONFIG} )
RELEASE_REQUIREMENTS=$( jq '.requirements' ${RELEASE_CONFIG} )

echo "Version ${RELEASE_VERSION} requirements: ${RELEASE_REQUIREMENTS}"

echo "Deploying to ${RELEASE_URL}"
