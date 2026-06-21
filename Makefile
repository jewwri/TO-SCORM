.PHONY: test check serve package clean

test:
	npm test

check:
	npm run check

serve:
	python3 -m http.server 8000

package: clean
	mkdir -p dist
	zip -r dist/scorm-app.zip \
		imsmanifest.xml index.html course-template.html styles.css telemetry.js course-state.js scorm.js course.js src \
		-x "*.DS_Store"

clean:
	rm -rf dist
