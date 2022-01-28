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

if [ -e "$RELEASE_CHANGELOG" ]; then
  echo "Parsing changelog from ${RELEASE_CHANGELOG}."
  release_changelog=$( cat ${RELEASE_CHANGELOG} )
else
  echo "No changelog found."
  release_changelog=''
fi

echo "Version ${RELEASE_VERSION} requirements: ${release_requirements}"

echo "Deploying ${RELEASE_ZIP} to ${WORDPRESS_RELEASE_URL}"

response=$(
curl \
  -X POST \
  -H "Content-Type: multipart/form-data" \
  --user "${WORDPRESS_USER}:${WORDPRESS_PASS}" \
  -s \
  -F "file_zip=@${RELEASE_ZIP}" \
  -F "version=${RELEASE_VERSION}" \
  -F "file_name=${RELEASE_FILE_NAME}" \
  -F "pre_release=${PRE_RELEASE}" \
  -F "requirements=${release_requirements}" \
  -F "changelog=${release_changelog}" \
  "${WORDPRESS_RELEASE_URL}"
)

release_id=$(echo ${response} | jq '.id')

if [ -z "$release_id" ]; then
  echo "Error response: ${response}"
  exit 1
else
  echo "Successful API response: ${response}"
fi
