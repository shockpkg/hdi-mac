all: test-disk-image-hybrid.iso\
	test-disk-image-hfsp.dmg \
	test-disk-image-hfsp-j.dmg \
	test-disk-image-hfsp-c.dmg \
	test-disk-image-hfsp-j-c.dmg \
	test-disk-image-apfs.dmg \
	test-disk-image-apfs-c.dmg

test-disk-image:
	mkdir 'test-disk-image'
	cat 'files/file-a.txt' > 'test-disk-image/file-a.txt'
	cat 'files/file-b.txt' > 'test-disk-image/file-b.txt'
	cat 'files/file-c.txt' > 'test-disk-image/file-c.txt'

test-disk-image-hybrid.iso: test-disk-image
	hdiutil makehybrid \
		-iso \
		-joliet \
		-default-volume-name 'test-disk-image-hybrid' \
		-o 'test-disk-image-hybrid.iso' \
		'test-disk-image'

test-disk-image-hfsp.dmg: test-disk-image
	hdiutil create \
		-fs 'HFS+' \
		-volname 'test-disk-image-hfsp' \
		-srcfolder 'test-disk-image' \
		-format 'UDZO' \
		'test-disk-image-hfsp.dmg'

test-disk-image-hfsp-j.dmg: test-disk-image
	hdiutil create \
		-fs 'Journaled HFS+' \
		-volname 'test-disk-image-hfsp-j' \
		-srcfolder 'test-disk-image' \
		-format 'UDZO' \
		'test-disk-image-hfsp-j.dmg'

test-disk-image-hfsp-c.dmg: test-disk-image
	hdiutil create \
		-fs 'Case-sensitive HFS+' \
		-volname 'test-disk-image-hfsp-c' \
		-srcfolder 'test-disk-image' \
		-format 'UDZO' \
		'test-disk-image-hfsp-c.dmg'

test-disk-image-hfsp-j-c.dmg: test-disk-image
	hdiutil create \
		-fs 'Case-sensitive Journaled HFS+' \
		-volname 'test-disk-image-hfsp-j-c' \
		-srcfolder 'test-disk-image' \
		-format 'UDZO' \
		'test-disk-image-hfsp-j-c.dmg'

test-disk-image-apfs.dmg: test-disk-image
	hdiutil create \
		-fs 'APFS' \
		-volname 'test-disk-image-apfs' \
		-srcfolder 'test-disk-image' \
		-format 'UDZO' \
		'test-disk-image-apfs.dmg'

test-disk-image-apfs-c.dmg: test-disk-image
	hdiutil create \
		-fs 'Case-sensitive APFS' \
		-volname 'test-disk-image-apfs-c' \
		-srcfolder 'test-disk-image' \
		-format 'UDZO' \
		'test-disk-image-apfs-c.dmg'
