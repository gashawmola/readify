#!/bin/bash
#
# God
#
# chkconfig: - 85 15
# description: start, stop, restart, status for God
#

RETVAL=0

case "$1" in
    start)
      god -P /var/run/god.pid -l /var/log/god.log
      god load /home/deploy/readify/config/god/readify.rb
      RETVAL=$?
      ;;
    stop)
      kill `cat /var/run/god.pid`
      RETVAL=$?
      ;;
    restart)
      kill `cat /var/run/god.pid`
      god -P /var/run/god.pid -l /var/log/god.log
      god load /home/deploy/readify/config/god/readify.rb
      RETVAL=$?
      ;;
    status)
      god status
      RETVAL=$?
      ;;
    *)
      echo "Usage: god {start|stop|restart|status}"
      exit 1
  ;;
esac

exit $RETVAL