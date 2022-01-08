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

release_url=$( jq '.url' ${RELEASE_CONFIG} )
release_version=$( jq '.version' ${RELEASE_CONFIG} )
release_requirements=$( jq '.requirements' ${RELEASE_CONFIG} )

echo "Version ${release_version} requirements: ${release_requirements}"

echo "Deploying to ${release_url}"

response=$(
curl \
  -X POST
  -H "Content-Type: multipart/form-data"
  --user "${WORDPRESS_USER}:${WORDPRESS_PASS}"
  -s -w "%{http_code}"
  -F "file_zip=@${RELEASE_ZIP}"
  -F "version=${release_version}"
  -F "file_name=${RELEASE_FILE_NAME}"
  -F "pre_release=${PRE_RELEASE}"
  -F "requirements=${release_requirements}"
  ${release_url}
)

http_code=$(tail -n1 <<< "$response")
content=$(sed '$ d' <<< "$response")

if [[ "$http_code" ne 201 ]]; then
  echo "Invalid response code: ${http_code}"
  echo "Content: ${content}"
  exit 1
fi
