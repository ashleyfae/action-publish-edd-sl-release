# !/usr/bin/bash

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

# Ensure that the WORDPRESS_RELEASE_URL secret is included
if [[ -z "$WORDPRESS_RELEASE_URL" ]]; then
  echo "Set the WORDPRESS_RELEASE_URL env variable."
  exit 1
fi

if [ -e "$RELEASE_CONFIG" ]; then
  echo "Parsing requirements from config."
  release_requirements=$( jq '.requirements' ${RELEASE_CONFIG} )
else
  echo "No config found; no requirements to parse."
  release_requirements=''
fi

echo "Version ${RELEASE_VERSION} requirements: ${release_requirements}"

echo "Deploying ${RELEASE_ZIP} to ${WORDPRESS_RELEASE_URL}"

response=$(
curl \
  -X POST \
  -H "Content-Type: multipart/form-data" \
  --user "${WORDPRESS_USER}:${WORDPRESS_PASS}" \
  -w "%{http_code}" \
  -F "file_zip=@${RELEASE_ZIP}" \
  -F "version=${RELEASE_VERSION}" \
  -F "file_name=${RELEASE_FILE_NAME}" \
  -F "pre_release=${PRE_RELEASE}" \
  -F "requirements=${release_requirements}" \
  "${WORDPRESS_RELEASE_URL}"
)

http_code=$(tail -n1 <<< "$response")
content=$(sed '$ d' <<< "$response")

if [[ $http_code != 201 ]]; then
  echo "Invalid response code: ${http_code}"
  echo "Content: ${content}"
  exit 1
fi
